import asyncio
import json
import random
import time
import psutil
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import uuid
import matplotlib.pyplot as plt
import numpy as np
from collections import defaultdict

import aiohttp
from faker import Faker
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TimeElapsedColumn

# Configuration
BASE_URL = "http://localhost:4000"
CONCURRENT_CLIENTS = 50
TOTAL_EVENTS = 10000
BATCH_SIZE = 50
REQUEST_TIMEOUT = 30
API_KEY = os.getenv("API_KEY", "your-api-key")  # Get API key from environment variable

fake = Faker()

def generate_event() -> Dict:
    """Generate a single realistic analytics event."""
    now = datetime.utcnow()
    event_types = ['page_view', 'click', 'scroll', 'form_submit', 'video_play', 'error']
    platforms = ['ios', 'android', 'web']
    device_types = ['mobile', 'desktop', 'tablet']
    network_types = ['wifi', 'cellular', 'unknown']
    event_type = random.choice(event_types)
    
    return {
        "event_id": str(uuid.uuid4()),
        "event_type": event_type,
        "event_name": f"{event_type}.{fake.word()}",
        "event_time": now.isoformat() + "Z",
        "user_id": str(uuid.uuid4()),
        "session_id": str(uuid.uuid4()),
        "page_name": f"/{fake.uri_path()}",
        "element_id": f"btn_{fake.word()}",
        "referrer": fake.uri(),
        "device_type": random.choice(device_types),
        "platform": random.choice(platforms),
        "app_version": f"{random.randint(1,5)}.{random.randint(0,9)}.{random.randint(0,9)}",
        "network_type": random.choice(network_types),
        "content": {
            "content_id": str(uuid.uuid4()),
            "content_type": random.choice(['post', 'comment', 'story', 'message', 'ad']),
            "media_type": random.choice(['image', 'video', 'text', 'audio']),
            "category": fake.word(),
            "is_sponsored": random.choice([True, False]),
            "age_hours": random.randint(1, 72)
        },
        "behavior": {
            "direction": random.choice(['up', 'down', 'left', 'right']),
            "position": random.randint(0, 100),
            "duration_ms": random.randint(100, 60000),
            "scroll_depth": random.randint(0, 100),
            "zoom_level": random.uniform(0.5, 2.0),
            "playback_position": random.randint(0, 300)
        },
        "performance": {
            "load_time_ms": random.randint(100, 5000),
            "connection_speed": random.choice(['slow', 'medium', 'fast'])
        },
        "location": {
            "city": fake.city(),
            "country": fake.country(),
            "timezone": fake.timezone(),
            "coordinates": {
                "latitude": float(fake.latitude()),
                "longitude": float(fake.longitude())
            }
        },
        "commerce": {
            "product_id": str(uuid.uuid4()),
            "price": round(random.uniform(0.99, 999.99), 2),
            "currency": "USD",
            "transaction_id": str(uuid.uuid4()),
            "promotion_code": fake.bothify(text='PROMO#??##')
        },
        "experiments": [str(uuid.uuid4()) for _ in range(random.randint(0, 3))],
        "extras": {
            "custom_field": fake.word(),
            "user_agent": fake.user_agent()
        }
    }

def generate_batch(size: int) -> Dict:
    """Generate a batch of events."""
    return {
        "batchId": str(uuid.uuid4()),
        "sentAt": datetime.utcnow().isoformat() + "Z",
        "clientInfo": {
            "sdkVersion": f"{random.randint(1,3)}.{random.randint(0,9)}.{random.randint(0,9)}",
            "deviceId": str(uuid.uuid4()),
            "appBuild": f"{random.randint(100,999)}"
        },
        "events": [generate_event() for _ in range(size)]
    }

class MetricsCollector:
    def __init__(self):
        self.successful_events = 0
        self.failed_events = 0
        self.response_times = []
        self.start_time = None
        self.end_time = None

    def add_result(self, success: bool, response_time: float, event_count: int = 1):
        self.response_times.append(response_time)
        if success:
            self.successful_events += event_count
        else:
            self.failed_events += event_count

    def start(self):
        self.start_time = time.time()

    def stop(self):
        self.end_time = time.time()

    def print_results(self):
        duration = self.end_time - self.start_time
        total_events = self.successful_events + self.failed_events
        avg_response_time = sum(self.response_times) / len(self.response_times) if self.response_times else 0
        
        print("\n=== Pressure Test Results ===")
        print(f"Duration: {duration:.2f} seconds")
        print(f"Total Events: {total_events}")
        print(f"Successful Events: {self.successful_events}")
        print(f"Failed Events: {self.failed_events}")
        print(f"Average Response Time: {avg_response_time:.3f} seconds")
        print(f"Throughput: {self.successful_events / duration:.2f} events/second")
        print(f"Error Rate: {(self.failed_events / total_events * 100):.2f}%")
        if self.response_times:
            print(f"Min Response Time: {min(self.response_times):.3f} seconds")
            print(f"Max Response Time: {max(self.response_times):.3f} seconds")

async def send_single_event(session: aiohttp.ClientSession, metrics: MetricsCollector):
    """Send a single event to the ingest endpoint."""
    event = generate_event()
    start_time = time.time()
    try:
        async with session.post(
            f"{BASE_URL}/ingest",
            json=event,
            headers={"X-API-Key": API_KEY},
            timeout=REQUEST_TIMEOUT
        ) as response:
            await response.text()
            print(f"Single event response status: {response.status}")
            metrics.add_result(
                response.status == 200,
                time.time() - start_time
            )
    except Exception as e:
        print(f"Error sending single event: {str(e)}")
        metrics.add_result(False, time.time() - start_time)

async def send_batch(session: aiohttp.ClientSession, batch_size: int, metrics: MetricsCollector):
    """Send a batch of events to the batch ingest endpoint."""
    batch = generate_batch(batch_size)
    start_time = time.time()
    try:
        async with session.post(
            f"{BASE_URL}/ingest/batch",
            json=batch,
            headers={"X-API-Key": API_KEY},
            timeout=REQUEST_TIMEOUT
        ) as response:
            await response.text()
            metrics.add_result(
                response.status == 200,
                time.time() - start_time,
                batch_size
            )
    except Exception as e:
        print(f"Error sending batch: {str(e)}")
        metrics.add_result(False, time.time() - start_time, batch_size)

async def run_pressure_test(test_type: str = "both"):
    """Run the pressure test with the specified type (single, batch, or both)."""
    metrics = MetricsCollector()
    metrics.start()
    
    async with aiohttp.ClientSession() as session:
        if test_type in ["single", "both"]:
            print("Testing single event ingestion...")
            single_tasks = [
                send_single_event(session, metrics)
                for _ in range(TOTAL_EVENTS)
            ]
            await asyncio.gather(*single_tasks)

        if test_type in ["batch", "both"]:
            print("\nTesting batch ingestion...")
            num_batches = TOTAL_EVENTS // BATCH_SIZE
            batch_tasks = [
                send_batch(session, BATCH_SIZE, metrics)
                for _ in range(num_batches)
            ]
            await asyncio.gather(*batch_tasks)

    metrics.stop()
    metrics.print_results()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='Run pressure tests on the analytics ingest service')
    parser.add_argument('--type', choices=['single', 'batch', 'both'], default='both',
                      help='Type of test to run (single, batch, or both)')
    parser.add_argument('--api-key', type=str, default=API_KEY,
                      help='API key for authentication')
    args = parser.parse_args()

    if args.api_key != "your-api-key":
        API_KEY = args.api_key
    
    print(f"Starting pressure test ({args.type})...")
    print(f"Concurrent Clients: {CONCURRENT_CLIENTS}")
    print(f"Total Events: {TOTAL_EVENTS}")
    print(f"Batch Size: {BATCH_SIZE}")
    print(f"API Key: {API_KEY if API_KEY != 'your-api-key' else 'Not set - please provide --api-key'}")
    
    if API_KEY == "your-api-key":
        print("Error: Please provide an API key using --api-key option or set the API_KEY environment variable")
        exit(1)
        
    asyncio.run(run_pressure_test(args.type))
