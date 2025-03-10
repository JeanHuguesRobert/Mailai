import { useState, useEffect } from 'react';
import { MantineProvider, AppShell, Navbar, Header, Text, Code, Group } from '@mantine/core';

export default function App() {
  const [logs, setLogs] = useState([]);
  const [config, setConfig] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const logsData = await fetch('/api/logs').then(r => r.json());
      const configData = await fetch('/api/config').then(r => r.json());
      setLogs(logsData);
      setConfig(configData.config);
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <MantineProvider>
      <AppShell
        padding="md"
        navbar={<Navbar width={{ base: 300 }} p="xs">
          <Text>Email Accounts</Text>
          {/* Add account list */}
        </Navbar>}
        header={<Header height={60} p="xs">
          <Group>
            <Text size="xl">Mailai Monitor</Text>
          </Group>
        </Header>}
      >
        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ flex: 1 }}>
            <Text size="xl">Live Logs</Text>
            {logs.map((log, i) => (
              <Code block key={i}>
                [{new Date(log.timestamp).toLocaleString()}] {log.type}: {log.message}
              </Code>
            ))}
          </div>
        </div>
      </AppShell>
    </MantineProvider>
  );
}
