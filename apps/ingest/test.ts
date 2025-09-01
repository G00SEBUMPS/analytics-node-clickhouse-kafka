import { Kafka } from 'kafkajs';

// Create Kafka client with test config
const kafka = new Kafka({ 
  clientId: 'test-client',
  brokers: ['localhost:9092'],
  retry: {
    initialRetryTime: 300,
    retries: 5
  },
  connectionTimeout: 10000,
  authenticationTimeout: 10000,
});

// Create producer
const producer = kafka.producer();

async function testConnection() {
  try {
    console.log('Connecting to Kafka...');
    await producer.connect();
    console.log('Successfully connected to Kafka!');
    
    // Try to send a test message
    await producer.send({
      topic: 'events.raw.v1',
      messages: [{
        value: JSON.stringify({
          event_name: 'test_event',
          tenant_id: 'test',
          event_time: new Date().toISOString(),
          metadata: { test: true }
        })
      }]
    });
    
    console.log('Successfully sent test message!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await producer.disconnect();
  }
}

testConnection();
