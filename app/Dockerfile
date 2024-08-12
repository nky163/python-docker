FROM mcr.microsoft.com/devcontainers/python:1-3.12-bullseye
USER vscode

WORKDIR /myapp
COPY --chown=vscode:vscode . .

WORKDIR /myapp/app
RUN curl -sSL https://install.python-poetry.org | python3 -
ENV PATH="/home/vscode/.local/bin:$PATH"
RUN poetry config virtualenvs.in-project true
RUN poetry install
