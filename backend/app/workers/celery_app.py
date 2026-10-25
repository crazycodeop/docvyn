import ssl
from celery import Celery
from app.core.config import settings

broker_url = settings.get_celery_broker_url()
backend_url = settings.get_celery_backend_url()

celery_app = Celery(
    "docrag_worker",
    broker=broker_url,
    backend=backend_url,
)

conf = {
    "task_serializer": "json",
    "accept_content": ["json"],
    "result_serializer": "json",
    "timezone": "UTC",
    "enable_utc": True,
    "task_track_started": True,
    "task_acks_late": True,
    "worker_prefetch_multiplier": 1,
    "task_reject_on_worker_lost": True,
    "task_time_limit": 300,
    "broker_connection_retry_on_startup": True,
    "broker_transport_options": {
        "max_retries": 3,
        "interval_start": 0,
        "interval_step": 0.2,
        "interval_max": 0.5,
    },
}

if broker_url.startswith("rediss://") or (backend_url and backend_url.startswith("rediss://")):
    conf["broker_use_ssl"] = {"ssl_cert_reqs": ssl.CERT_NONE}
    conf["redis_backend_use_ssl"] = {"ssl_cert_reqs": ssl.CERT_NONE}

celery_app.conf.update(conf)
celery_app.autodiscover_tasks(["app.workers"])
