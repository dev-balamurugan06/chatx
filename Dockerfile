FROM node:22-alpine AS frontend-build

WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production \
    FRONTEND_DIST=/app/frontend_dist

WORKDIR /app
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt
COPY backend/ /app/backend/
COPY database/ /app/database/
COPY --from=frontend-build /build/frontend/dist/ /app/frontend_dist/

WORKDIR /app/backend
EXPOSE 8080
CMD ["sh", "-c", "python init_db.py && exec gunicorn --bind 0.0.0.0:${PORT:-8080} --workers 2 --timeout 180 app:app"]
