# 開発用イメージ
FROM mcr.microsoft.com/devcontainers/python:1-3.12-bullseye AS development
USER vscode
WORKDIR /myapp
COPY --chown=vscode:vscode . .
WORKDIR /myapp/app
RUN curl -sSL https://install.python-poetry.org | python3 -
ENV PATH="/home/vscode/.local/bin:$PATH"
ENV PYTHONPATH="/myapp/app/src"
RUN poetry config virtualenvs.in-project true
RUN poetry install

# 商用(ECRプッシュ用)イメージ
FROM python:3.12-slim-bullseye AS production
WORKDIR /app
COPY app/pyproject.toml app/poetry.lock app/src /app/
ENV PYTHONPATH="/app"
RUN pip install poetry && poetry install
CMD ["poetry", "run", "python", "/app/web/app.py"]