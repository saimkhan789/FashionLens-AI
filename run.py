"""FashionLens AI — one command to run everything.

    python run.py                 build the frontend if needed, start the app on :8000
    python run.py --dev           API with auto-reload + Next.js dev server (hot reload) on :3000
    python run.py import <url>    import a store's catalogue from the command line
                                  (e.g. python run.py import https://www.limelight.pk --name Limelight)

Without DATABASE_URL in backend/.env, a local Postgres (with pgvector) is started in Docker.
"""
import argparse
import os
import shutil
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
IS_WINDOWS = os.name == "nt"
VENV = BACKEND / "venv"
VENV_PYTHON = VENV / ("Scripts/python.exe" if IS_WINDOWS else "bin/python")

DB_CONTAINER = "fashionlens-db"
DB_IMAGE = "pgvector/pgvector:pg16"
DB_PORT = 5433


def log(msg: str) -> None:
    print(f"\033[36m[run]\033[0m {msg}", flush=True)


def fail(msg: str) -> None:
    print(f"\033[31m[run] {msg}\033[0m", file=sys.stderr)
    sys.exit(1)


# ---------------------------------------------------------------- Python env

def ensure_venv() -> None:
    """Re-launch inside backend/venv (creating it on first run) so deps stay isolated."""
    if Path(sys.prefix).resolve() == VENV.resolve():
        return
    if not VENV_PYTHON.exists():
        log("Creating Python virtualenv in backend/venv ...")
        subprocess.check_call([sys.executable, "-m", "venv", str(VENV)])
    sys.exit(subprocess.call([str(VENV_PYTHON), __file__, *sys.argv[1:]]))


def ensure_python_deps() -> None:
    try:
        import asyncpg, fastapi, open_clip, pgvector, sqlalchemy, transformers  # noqa: F401,E401
    except ImportError:
        log("Installing Python dependencies (first run, this takes a few minutes) ...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", str(BACKEND / "requirements.txt")])


# ---------------------------------------------------------------- Database

def read_env() -> dict:
    env = {}
    env_file = BACKEND / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return {**env, **os.environ}


def docker(*args: str, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(["docker", *args], capture_output=True, text=True, check=check)


def ensure_local_db() -> None:
    if not shutil.which("docker"):
        fail("No DATABASE_URL set and Docker isn't installed.\n"
             "      Either install Docker Desktop, or create a free Postgres at https://neon.tech\n"
             "      and put DATABASE_URL=postgresql://... in backend/.env")
    if docker("info", check=False).returncode != 0:
        fail("Docker is installed but not running — start Docker Desktop and try again.")

    state = docker("ps", "-a", "--filter", f"name=^{DB_CONTAINER}$", "--format", "{{.State}}").stdout.strip()
    if not state:
        log(f"Creating local Postgres container '{DB_CONTAINER}' on port {DB_PORT} ...")
        docker("run", "-d", "--name", DB_CONTAINER, "--restart", "unless-stopped",
               "-e", "POSTGRES_USER=fashionlens", "-e", "POSTGRES_PASSWORD=fashionlens", "-e", "POSTGRES_DB=fashionlens",
               "-p", f"{DB_PORT}:5432", "-v", "fashionlens-pgdata:/var/lib/postgresql/data", DB_IMAGE)
    elif state != "running":
        log("Starting local Postgres ...")
        docker("start", DB_CONTAINER)

    for _ in range(60):
        if docker("exec", DB_CONTAINER, "pg_isready", "-U", "fashionlens", check=False).returncode == 0:
            return
        time.sleep(1)
    fail("Postgres container didn't become ready — check `docker logs fashionlens-db`")


def ensure_database() -> None:
    if read_env().get("DATABASE_URL"):
        log("Using DATABASE_URL from backend/.env")
    else:
        ensure_local_db()


# ---------------------------------------------------------------- Frontend

def npm(*args: str) -> None:
    exe = shutil.which("npm")
    if not exe:
        fail("Node.js isn't installed — get it from https://nodejs.org (LTS).")
    subprocess.check_call([exe, *args], cwd=FRONTEND)


def ensure_node_modules() -> None:
    lock = FRONTEND / "package-lock.json"
    marker = FRONTEND / "node_modules" / ".package-lock.json"
    if not marker.exists() or marker.stat().st_mtime < lock.stat().st_mtime:
        log("Installing frontend dependencies ...")
        npm("install")


def newest_mtime(*paths: Path) -> float:
    newest = 0.0
    for p in paths:
        files = p.rglob("*") if p.is_dir() else [p]
        newest = max([newest, *(f.stat().st_mtime for f in files if f.is_file())])
    return newest


def ensure_frontend_built() -> None:
    ensure_node_modules()
    built = FRONTEND / "out" / "index.html"
    sources = [FRONTEND / "src", FRONTEND / "public", FRONTEND / "next.config.ts", FRONTEND / "package.json"]
    if built.exists() and built.stat().st_mtime >= newest_mtime(*sources):
        return
    log("Building the frontend ...")
    npm("run", "build")


# ---------------------------------------------------------------- Commands

def wait_for(url: str, timeout: float = 120) -> bool:
    import urllib.request

    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2):
                return True
        except Exception:
            time.sleep(1)
    return False


def stop(procs: list[subprocess.Popen]) -> None:
    for p in procs:
        if p.poll() is None:
            if IS_WINDOWS:  # uvicorn --reload and next spawn children: kill the tree
                subprocess.run(["taskkill", "/PID", str(p.pid), "/T", "/F"], capture_output=True)
            else:
                p.terminate()


def serve(args) -> None:
    ensure_database()
    procs = []
    uvicorn = [sys.executable, "-m", "uvicorn", "app.main:app", "--host", args.host, "--port", str(args.port)]
    try:
        if args.dev:
            ensure_node_modules()
            procs.append(subprocess.Popen([*uvicorn, "--reload"], cwd=BACKEND))
            env = {**os.environ, "API_PROXY_TARGET": f"http://127.0.0.1:{args.port}"}
            procs.append(subprocess.Popen([shutil.which("npm"), "run", "dev"], cwd=FRONTEND, env=env))
            url = "http://localhost:3000"
        else:
            ensure_frontend_built()
            procs.append(subprocess.Popen(uvicorn, cwd=BACKEND))
            url = f"http://localhost:{args.port}"

        if wait_for(f"http://127.0.0.1:{args.port}/api/health") and wait_for(url):
            log(f"FashionLens is running at {url}  (AI models finish loading in the background)")
            if not args.no_browser:
                webbrowser.open(url)
        while all(p.poll() is None for p in procs):
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        stop(procs)


def import_store(args) -> None:
    ensure_database()
    sys.path.insert(0, str(BACKEND))
    os.chdir(BACKEND)
    import asyncio

    async def main():
        from sqlalchemy import select

        from app.ai import models as ai
        from app.db import SessionLocal, init_db
        from app.ingest import pipeline
        from app.ingest.platforms import normalize_store_url
        from app.models import ImportJob, Store

        await init_db()
        ai.start_loading()
        url = normalize_store_url(args.url)
        async with SessionLocal() as s:
            store = await s.scalar(select(Store).where(Store.url == url))
            if not store:
                store = Store(url=url, name=args.name or url.split("://")[1].removeprefix("www.").split(".")[0].title())
                s.add(store)
                await s.flush()
            job = ImportJob(store_id=store.id)
            s.add(job)
            await s.commit()
        log(f"Importing {store.name} ({url}) ...")

        async def progress():
            while True:
                await asyncio.sleep(10)
                async with SessionLocal() as s:
                    j = await s.get(ImportJob, job.id)
                log(f"{j.stage or j.status}: {j.found} found, {j.embedded}/{j.to_embed} images embedded")

        reporter = asyncio.create_task(progress())
        await pipeline.run_job(job.id)
        reporter.cancel()
        async with SessionLocal() as s:
            j = await s.get(ImportJob, job.id)
        if j.status != "done":
            fail(f"Import failed: {j.error}")

    asyncio.run(main())


def main() -> None:
    parser = argparse.ArgumentParser(description="Run FashionLens AI", formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__)
    sub = parser.add_subparsers(dest="command")
    parser.add_argument("--dev", action="store_true", help="hot-reload mode (Next.js dev server on :3000)")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8000)))
    parser.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"))
    parser.add_argument("--no-browser", action="store_true")
    imp = sub.add_parser("import", help="import a store's catalogue")
    imp.add_argument("url")
    imp.add_argument("--name", help="brand name to show (defaults to the domain)")
    args = parser.parse_args()

    ensure_venv()
    ensure_python_deps()
    if args.command == "import":
        import_store(args)
    else:
        serve(args)


if __name__ == "__main__":
    main()
