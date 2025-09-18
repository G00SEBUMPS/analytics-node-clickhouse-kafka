import asyncio
import json
import random
import time
import psutil
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Literal
import uuid
import matplotlib.pyplot as plt
import numpy as np
from collections import defaultdict
from enum import Enum

import aiohttp
from faker import Faker
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TimeElapsedColumn
from rich.table import Table

# Configuration
BASE_URL = "http://localhost:4000"
CONCURRENT_CLIENTS = 50
TOTAL_EVENTS = 10000
BATCH_SIZE = 50
REQUEST_TIMEOUT = 30
API_KEY = "ak_1ea8cb9b2466593cd30f142665df07fe94e687b64c72e49d303a8cd826598e66"

console = Console()
fake = Faker()

class EnhancedMetricsCollector:
    def __init__(self, scenario_name: str):
        self.scenario_name = scenario_name
        self.start_time = None
        self.end_time = None
        self.response_times = []
        self.successful_events = 0
        self.failed_events = 0
        self.error_types = defaultdict(int)
        self.status_codes = defaultdict(int)
        self.event_timestamps = []
        self.cpu_usage = []
        self.memory_usage = []
        
    def start(self):
        """Start collecting metrics."""
        self.start_time = time.time()
        self._start_resource_monitoring()
        
    def stop(self):
        """Stop collecting metrics."""
        self.end_time = time.time()
        self._stop_resource_monitoring()
        
    def add_result(self, success: bool, response_time: float, 
                  status_code: Optional[int] = None, 
                  error_type: Optional[str] = None,
                  event_count: int = 1):
        """Add a result to the metrics."""
        self.response_times.append(response_time)
        self.event_timestamps.append(time.time())
        
        if success:
            self.successful_events += event_count
            if status_code:
                self.status_codes[status_code] += event_count
        else:
            self.failed_events += event_count
            if error_type:
                self.error_types[error_type] += event_count
        
        # Sample system resources
        self.cpu_usage.append(psutil.cpu_percent())
        self.memory_usage.append(psutil.Process().memory_info().rss / 1024 / 1024)  # MB
        
    def _start_resource_monitoring(self):
        """Start monitoring system resources."""
        self.cpu_usage = []
        self.memory_usage = []
        
    def _stop_resource_monitoring(self):
        """Stop monitoring system resources."""
        pass
        
    def print_results(self):
        """Print detailed metrics results."""
        duration = self.end_time - self.start_time
        total_events = self.successful_events + self.failed_events
        success_rate = (self.successful_events / total_events * 100 
                       if total_events > 0 else 0)
        
        console.print(f"\n[bold green]Results for {self.scenario_name}[/bold green]")
        
        # Performance Metrics
        table = Table(title="Performance Metrics")
        table.add_column("Metric", justify="left", style="cyan")
        table.add_column("Value", justify="right", style="green")
        
        table.add_row("Duration", f"{duration:.2f}s")
        table.add_row("Total Events", str(total_events))
        table.add_row("Success Rate", f"{success_rate:.1f}%")
        table.add_row("Average Response Time", 
                     f"{np.mean(self.response_times):.3f}s")
        table.add_row("P95 Response Time",
                     f"{np.percentile(self.response_times, 95):.3f}s")
        table.add_row("Throughput", 
                     f"{total_events/duration:.1f} events/s")
        
        console.print(table)
        
        # Resource Usage
        if self.cpu_usage and self.memory_usage:
            resource_table = Table(title="Resource Usage")
            resource_table.add_column("Resource", justify="left", style="cyan")
            resource_table.add_column("Average", justify="right", style="green")
            resource_table.add_column("Peak", justify="right", style="red")
            
            resource_table.add_row(
                "CPU Usage",
                f"{np.mean(self.cpu_usage):.1f}%",
                f"{np.max(self.cpu_usage):.1f}%"
            )
            resource_table.add_row(
                "Memory Usage",
                f"{np.mean(self.memory_usage):.1f}MB",
                f"{np.max(self.memory_usage):.1f}MB"
            )
            
            console.print(resource_table)
        
        # Error Distribution
        if self.error_types:
            error_table = Table(title="Error Distribution")
            error_table.add_column("Error Type", justify="left", style="red")
            error_table.add_column("Count", justify="right", style="yellow")
            
            for error_type, count in self.error_types.items():
                error_table.add_row(error_type, str(count))
            
            console.print(error_table)
            
    def plot_results(self, filename_prefix: str):
        """Generate plots for the collected metrics."""
        # Create a figure with subplots
        fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 10))
        fig.suptitle(f'Performance Metrics - {self.scenario_name}')
        
        # Response Time Distribution
        ax1.hist(self.response_times, bins=50, alpha=0.75)
        ax1.set_title('Response Time Distribution')
        ax1.set_xlabel('Response Time (s)')
        ax1.set_ylabel('Count')
        
        # Throughput over time
        timestamps = np.array(self.event_timestamps) - self.start_time
        ax2.plot(timestamps, range(len(timestamps)))
        ax2.set_title('Cumulative Events Over Time')
        ax2.set_xlabel('Time (s)')
        ax2.set_ylabel('Events')
        
        # CPU Usage
        if self.cpu_usage:
            ax3.plot(range(len(self.cpu_usage)), self.cpu_usage)
            ax3.set_title('CPU Usage')
            ax3.set_xlabel('Sample')
            ax3.set_ylabel('CPU %')
        
        # Memory Usage
        if self.memory_usage:
            ax4.plot(range(len(self.memory_usage)), self.memory_usage)
            ax4.set_title('Memory Usage')
            ax4.set_xlabel('Sample')
            ax4.set_ylabel('Memory (MB)')
        
        plt.tight_layout()
        plt.savefig(f'{filename_prefix}_metrics.png')
        plt.close()

class EventType(Enum):
    CLICK = 'cl'
    ACTION = 'ac'
    IMPRESSION = 'im'
    ERROR = 'er'

class DeviceType(Enum):
    MOBILE = 'mobile'
    DESKTOP = 'desktop'
    TABLET = 'tablet'

class Platform(Enum):
    IOS = 'ios'
    ANDROID = 'android'
    WEB = 'web'

class NetworkType(Enum):
    WIFI = 'wifi'
    CELLULAR = 'cellular'
    UNKNOWN = 'unknown'

def generate_click_event() -> Dict:
    """Generate a click event with realistic data."""
    now = datetime.utcnow()
    click_targets = ['button', 'link', 'menu_item', 'tab', 'form']
    actions = ['submit', 'navigate', 'toggle', 'select', 'close']
    
    return {
        "event_type": EventType.CLICK.value,
        "event_id": str(uuid.uuid4()),
        "event_name": f"{random.choice(click_targets)}_{random.choice(actions)}",
        "page_name": f"/{fake.uri_path()}",
        "element_id": f"{random.choice(click_targets)}_{uuid.uuid4().hex[:8]}",
        "user_id": str(uuid.uuid4()),
        "session_id": str(uuid.uuid4()),
        "event_time": now.isoformat() + "Z",
        "device_type": random.choice(list(DeviceType)).value,
        "platform": random.choice(list(Platform)).value,
        "app_version": f"{random.randint(1,5)}.{random.randint(0,9)}.{random.randint(0,9)}",
        "network_type": random.choice(list(NetworkType)).value,
        "content": {
            "category": fake.word(),
            "mediaType": random.choice(['image', 'video', 'text']),
            "isSponsored": random.choice([True, False])
        },
        "behavior": {
            "position": random.randint(0, 100),
            "durationMs": random.randint(50, 1000),
            "scrollDepth": random.randint(0, 100)
        },
        "performance": {
            "loadTimeMs": random.randint(100, 2000),
            "connectionSpeed": random.choice(['slow', 'medium', 'fast'])
        }
    }

def generate_action_event() -> Dict:
    """Generate an action event with realistic data."""
    now = datetime.utcnow()
    actions = ['share', 'follow', 'post', 'comment', 'upload']
    
    return {
        "event_id": str(uuid.uuid4()),
        "event_type": EventType.ACTION.value,
        "event_name": f"{random.choice(actions)}_action",
        "page_name": f"/{fake.uri_path()}",
        "element_id": f"action_{uuid.uuid4().hex[:8]}",
        "user_id": str(uuid.uuid4()),
        "session_id": str(uuid.uuid4()),
        "event_time": now.isoformat() + "Z",
        "device_type": random.choice(list(DeviceType)).value,
        "platform": random.choice(list(Platform)).value,
        "app_version": f"{random.randint(1,5)}.{random.randint(0,9)}.{random.randint(0,9)}",
        "network_type": random.choice(list(NetworkType)).value,
        "content": {
            "postId": str(uuid.uuid4()),
            "mediaType": random.choice(['image', 'video', 'text']),
            "category": fake.word(),
            "ageHours": random.randint(0, 72)
        },
        "interaction": {
            "senderId": str(uuid.uuid4()),
            "receiverId": str(uuid.uuid4()),
            "interactionType": random.choice(['like', 'comment', 'share', 'follow'])
        },
        "location": {
            "city": fake.city(),
            "country": fake.country(),
            "timezone": fake.timezone()
        }
    }

def generate_impression_event() -> Dict:
    """Generate an impression event with realistic data."""
    now = datetime.utcnow()
    content_types = ['post', 'ad', 'story', 'recommendation']
    
    return_dict = {
        "event_id": str(uuid.uuid4()),
        "event_type": EventType.IMPRESSION.value,
        "event_name": f"{random.choice(content_types)}_impression",
        "page_name": f"/{fake.uri_path()}",
        "element_id": f"impression_{uuid.uuid4().hex[:8]}",
        "user_id": str(uuid.uuid4()),
        "session_id": str(uuid.uuid4()),
        "event_time": now.isoformat() + "Z",
        "device_type": random.choice(list(DeviceType)).value,
        "platform": random.choice(list(Platform)).value,
        "app_version": f"{random.randint(1,5)}.{random.randint(0,9)}.{random.randint(0,9)}",
        "network_type": random.choice(list(NetworkType)).value,
        "content": {
            "postId": str(uuid.uuid4()),
            "adId": str(uuid.uuid4()) if random.choice([True, False]) else None,
            "mediaType": random.choice(['image', 'video', 'text']),
            "category": fake.word(),
            "isSponsored": random.choice([True, False]),
            "ageHours": random.randint(0, 72)
        }
    }
    
    # Optionally add commerce data
    event = return_dict.copy()
    if random.choice([True, False]):
        event["commerce"] = {
            "productId": str(uuid.uuid4()),
            "price": round(random.uniform(0.99, 999.99), 2),
            "currency": "USD"
        }
    
    return event

def generate_error_event() -> Dict:
    """Generate an error event with realistic data."""
    now = datetime.utcnow()
    error_types = ['network', 'validation', 'timeout', 'api', 'upload']
    components = ['feed', 'profile', 'messaging', 'upload', 'search']
    
    return {
        "event_id": str(uuid.uuid4()),
        "event_type": EventType.ERROR.value,
        "event_name": f"{random.choice(error_types)}_error",
        "page_name": f"/{fake.uri_path()}",
        "element_id": f"{random.choice(components)}_{uuid.uuid4().hex[:8]}",
        "user_id": str(uuid.uuid4()),
        "session_id": str(uuid.uuid4()),
        "event_time": now.isoformat() + "Z",
        "device_type": random.choice(list(DeviceType)).value,
        "platform": random.choice(list(Platform)).value,
        "app_version": f"{random.randint(1,5)}.{random.randint(0,9)}.{random.randint(0,9)}",
        "network_type": random.choice(list(NetworkType)).value,
        "error": {
            "errorCode": f"ERR_{random.randint(1000, 9999)}",
            "errorMessage": fake.sentence(),
            "retryCount": random.randint(0, 3)
        },
        "performance": {
            "loadTimeMs": random.randint(1000, 10000),
            "connectionSpeed": random.choice(['slow', 'medium', 'fast'])
        }
    }

def generate_mixed_event() -> Dict:
    """Generate a random event of any type."""
    generators = [
        generate_click_event,
        generate_action_event,
        generate_impression_event,
        generate_error_event
    ]
    return random.choice(generators)()

def generate_batch(size: int, event_type: Optional[str] = None) -> Dict:
    """Generate a batch of events, optionally of a specific type."""
    event_generators = {
        'cl': generate_click_event,
        'ac': generate_action_event,
        'im': generate_impression_event,
        'er': generate_error_event,
        None: generate_mixed_event
    }
    
    generator = event_generators[event_type]
    
    return {
        "batchId": str(uuid.uuid4()),
        "sentAt": datetime.utcnow().isoformat() + "Z",
        "clientInfo": {
            "sdkVersion": f"{random.randint(1,3)}.{random.randint(0,9)}.{random.randint(0,9)}",
            "deviceId": str(uuid.uuid4()),
            "appBuild": f"{random.randint(100,999)}"
        },
        "events": [generator() for _ in range(size)]
    }

class TestScenario:
    def __init__(self, name: str, event_type: Optional[str], batch_size: int, 
                 total_events: int, concurrent_clients: int):
        self.name = name
        self.event_type = event_type
        self.batch_size = batch_size
        self.total_events = total_events
        self.concurrent_clients = concurrent_clients
        self.metrics = EnhancedMetricsCollector(name)

class PressureTest:
    def __init__(self):
        self.scenarios = [
            # Single event type scenarios
            TestScenario("Click Events", "cl", 1, 1000, 20),
            TestScenario("Action Events", "ac", 1, 1000, 20),
            TestScenario("Impression Events", "im", 1, 1000, 20),
            TestScenario("Error Events", "er", 1, 1000, 20),
            
            # Batch scenarios
            TestScenario("Mixed Batch", None, 50, 5000, 50),
            TestScenario("Large Batch", None, 100, 10000, 30),
            
            # Load scenarios
            TestScenario("High Concurrency", None, 10, 20000, 100),
            TestScenario("Sustained Load", None, 20, 50000, 40)
        ]
        
    async def run_scenario(self, scenario: TestScenario):
        """Run a single test scenario."""
        console.print(f"\n[bold blue]Running Scenario: {scenario.name}[/bold blue]")
        console.print(f"Events: {scenario.total_events:,} | Batch Size: {scenario.batch_size} | Concurrent: {scenario.concurrent_clients}")
        
        scenario.metrics.start()
        connector = aiohttp.TCPConnector(limit=scenario.concurrent_clients)
        
        async with aiohttp.ClientSession(connector=connector) as session:
            with Progress(SpinnerColumn(), *Progress.get_default_columns(), 
                         TimeElapsedColumn(), console=console) as progress:
                
                task_id = progress.add_task(f"Processing...", total=scenario.total_events)
                batch_tasks = []
                events_processed = 0
                
                while events_processed < scenario.total_events:
                    batch_size = min(scenario.batch_size, scenario.total_events - events_processed)
                    batch = generate_batch(batch_size, scenario.event_type)
                    
                    batch_tasks.append(self.send_batch(session, batch, scenario.metrics))
                    if len(batch_tasks) >= scenario.concurrent_clients:
                        await asyncio.gather(*batch_tasks)
                        events_processed += len(batch_tasks) * batch_size
                        progress.update(task_id, completed=events_processed)
                        batch_tasks = []
                
                if batch_tasks:
                    await asyncio.gather(*batch_tasks)
                    events_processed += len(batch_tasks) * batch_size
                    progress.update(task_id, completed=events_processed)
        
        scenario.metrics.stop()
        scenario.metrics.print_results()
        scenario.metrics.plot_results(scenario.name.lower().replace(" ", "_"))

    async def send_batch(self, session: aiohttp.ClientSession, batch: Dict, 
                        metrics: EnhancedMetricsCollector):
        """Send a batch of events."""
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
                    status_code=response.status,
                    event_count=len(batch["events"])
                )
        except asyncio.TimeoutError:
            metrics.add_result(False, time.time() - start_time, 
                             error_type="timeout", event_count=len(batch["events"]))
        except Exception as e:
            metrics.add_result(False, time.time() - start_time,
                             error_type=str(type(e).__name__), event_count=len(batch["events"]))

    async def run_all_scenarios(self):
        """Run all test scenarios sequentially."""
        console.print("[bold green]Starting Comprehensive Pressure Test[/bold green]")
        
        for scenario in self.scenarios:
            await self.run_scenario(scenario)
        
        self.print_summary()

    def print_summary(self):
        """Print a summary of all test scenarios."""
        console.print("\n[bold green]Test Scenarios Summary[/bold green]")
        
        table = Table(show_header=True)
        table.add_column("Scenario")
        table.add_column("Success Rate")
        table.add_column("Avg Response Time")
        table.add_column("Throughput")
        table.add_column("P95 Latency")
        
        for scenario in self.scenarios:
            metrics = scenario.metrics
            success_rate = (metrics.successful_events / 
                          (metrics.successful_events + metrics.failed_events) * 100)
            avg_response_time = (sum(metrics.response_times) / 
                               len(metrics.response_times) if metrics.response_times else 0)
            throughput = metrics.successful_events / (metrics.end_time - metrics.start_time)
            p95_latency = np.percentile(metrics.response_times, 95) if metrics.response_times else 0
            
            table.add_row(
                scenario.name,
                f"{success_rate:.1f}%",
                f"{avg_response_time:.3f}s",
                f"{throughput:.1f} evt/s",
                f"{p95_latency:.3f}s"
            )
        
        console.print(table)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='Run comprehensive pressure tests')
    parser.add_argument('--scenario', type=int, help='Run a specific scenario (0-7)')
    parser.add_argument('--api-key', type=str, default=API_KEY,
                      help='API key for authentication')
    
    args = parser.parse_args()
    API_KEY = args.api_key
    
    test = PressureTest()
    if args.scenario is not None:
        asyncio.run(test.run_scenario(test.scenarios[args.scenario]))
    else:
        asyncio.run(test.run_all_scenarios())