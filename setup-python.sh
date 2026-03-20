#!/usr/bin/env bash
# Aeolus Python environment bootstrap (Linux/macOS / CI e.g. Render)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_DIR="$REPO_ROOT/python"
VENV_DIR="$PYTHON_DIR/venv"
REQUIREMENTS_FILE="$PYTHON_DIR/requirements.txt"
VENV_PYTHON="$VENV_DIR/bin/python"

echo "Initializing Aeolus Python environment..."
echo ""

if [[ ! -f "$REQUIREMENTS_FILE" ]]; then
  echo "Requirements file not found: $REQUIREMENTS_FILE" >&2
  exit 1
fi

mkdir -p "$PYTHON_DIR"

if [[ ! -x "$VENV_PYTHON" ]]; then
  echo "Creating virtual environment..."
  python3 -m venv "$VENV_DIR"
fi

if [[ ! -x "$VENV_PYTHON" ]]; then
  echo "Failed to create venv or python not found at: $VENV_PYTHON" >&2
  exit 1
fi

echo "Upgrading pip..."
"$VENV_PYTHON" -m pip install --upgrade pip

echo "Installing shared dependencies..."
"$VENV_PYTHON" -m pip install -r "$REQUIREMENTS_FILE"

echo ""
echo "Python environment is ready."
echo "Python: $VENV_PYTHON"
