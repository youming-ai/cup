FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && playwright install --with-deps chromium

# Xvfb: run a real headed Chromium under a virtual display. The ad player only
# initialises its stream under the full browser engine (not headless-shell).
RUN apt-get update && apt-get install -y --no-install-recommends xvfb xauth \
    && rm -rf /var/lib/apt/lists/*

COPY server.py ./

EXPOSE 8081
CMD ["sh", "-c", "xvfb-run -a uvicorn server:app --host 0.0.0.0 --port 8081"]
