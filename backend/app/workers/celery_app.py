from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "docrag_worker",
    broker=settings.get_celery_broker_url(),
    backend=settings.get_celery_backend_url(),
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_reject_on_worker_lost=True,
    task_time_limit=300,
    broker_connection_retry_on_startup=True,
    broker_transport_options={
        "max_retries": 1,
        "interval_start": 0,
        "interval_step": 0.2,
        "interval_max": 0.5,
        "socket_timeout": 1.0,
        "socket_connect_timeout": 1.0,
    },
)

celery_app.autodiscover_tasks(["app.workers"])
