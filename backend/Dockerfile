FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

WORKDIR /app

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend/app_cloud.py /app/app_cloud.py
COPY backend/entrypoint.sh /app/entrypoint.sh
COPY backend/seed_from_export.py /app/seed_from_export.py
COPY backend/images/*.jpg /app/images/
COPY index.html /app/index.html
COPY search.html /app/search.html
COPY styles.css /app/styles.css
COPY script.js /app/script.js
COPY ["Adobe Scan Aug 29, 2025.pdf", "/app/Adobe Scan Aug 29, 2025.pdf"]
COPY deploy-static/alfajores.json /app/seeds/alfajores.json

RUN chmod +x /app/entrypoint.sh && mkdir -p /app/uploads

EXPOSE 8080

CMD ["/app/entrypoint.sh"]
