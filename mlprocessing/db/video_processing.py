import json

import psycopg2

from config import DATABASE_URL, DB_HOST, DB_NAME, DB_PASS, DB_USER

conn = None


def get_connection():
    global conn

    if conn is not None and conn.closed == 0:
        return conn

    if DATABASE_URL:
        conn = psycopg2.connect(DATABASE_URL)
    else:
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASS
        )

    conn.autocommit = True
    return conn


def update_status(video_id, status):
    with get_connection().cursor() as cur:
        cur.execute(
            """
            UPDATE "VideoProcessing"
            SET status = %s, "updatedAt" = NOW()
            WHERE id = %s
            """,
            (status, video_id),
        )


def save_result(video_id, result):
    with get_connection().cursor() as cur:
        cur.execute(
            """
            UPDATE "VideoProcessing"
            SET status = %s,
                "resultData" = %s,
                "updatedAt" = NOW()
            WHERE id = %s
            """,
            (
                "COMPLETED",
                json.dumps(result),
                video_id,
            ),
        )


def mark_failed(video_id, error):
    with get_connection().cursor() as cur:
        cur.execute(
            """
            UPDATE "VideoProcessing"
            SET status = %s,
                "resultData" = %s,
                "updatedAt" = NOW()
            WHERE id = %s
            """,
            (
                "FAILED",
                json.dumps({"error": str(error)}),
                video_id,
            ),
        )
