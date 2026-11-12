import React, { useEffect, useState } from 'react';
import { addMcpServer, listMcpServers, removeMcpServer, setMcpServerEnabled, testMcpServer, type McpServerInfo } from '../utils/assistantApi';
import { Button } from './ui/Actions';
import { Badge } from './ui/Display';
import { Switch, TextInput } from './ui/Fields';
import { Banner } from './ui/States';

const messageOf = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

/** Outside MCP servers Ask Crystal may use. Only tools that say they are read-only are ever called. */
const McpServersPanel: React.FC = () => {
  const [servers, setServers] = useState<McpServerInfo[] | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [isBusy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = () => listMcpServers().then(setServers).catch(failure => setError(messageOf(failure, 'Could not list the connected servers.')));
  useEffect(() => { void load(); }, []);

  const guard = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try { await work(); } catch (failure) { setError(messageOf(failure, 'Something went wrong.')); } finally { setBusy(false); }
  };

  const add = () => guard(async () => {
    await addMcpServer({ name: name.trim(), url: url.trim(), ...(token ? { token } : {}) });
    setName(''); setUrl(''); setToken('');
    await load();
  });

  const test = (server: McpServerInfo) => guard(async () => {
    const { exposed, hidden } = await testMcpServer(server.id);
    setNotice(`${server.name}: ${exposed.length} read-only ${exposed.length === 1 ? 'tool' : 'tools'} in use${hidden.length ? `, ${hidden.length} left out because they do not say they are read-only` : ''}.`);
  });

  return (
    <div className="space-y-4">
      <div>
        <h4 className="type-body-strong text-ink">Connected tools</h4>
        <p className="type-caption text-muted">Add an outside MCP server so Ask Crystal can look things up there too. Crystal only uses tools that declare themselves read-only, and treats what comes back as information, never as instructions. Questions you ask may be sent to it.</p>
      </div>
      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="info">{notice}</Banner>}

      {servers && servers.length > 0 && (
        <ul className="divide-y divide-line">
          {servers.map(server => (
            <li key={server.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="type-body-strong text-ink">{server.name}</span>
                  {server.hasToken && <Badge tone="neutral">Token saved</Badge>}
                </div>
                <p className="type-caption text-muted break-all">{server.url}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Switch isSelected={server.enabled} isDisabled={isBusy} onChange={on => void guard(async () => { await setMcpServerEnabled(server.id, on); await load(); })}>Use</Switch>
                <Button size="sm" variant="ghost" isDisabled={isBusy} onPress={() => void test(server)}>Test</Button>
                <Button size="sm" variant="ghost" isDisabled={isBusy} onPress={() => void guard(async () => { await removeMcpServer(server.id); await load(); })}>Remove</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <TextInput label="Name" value={name} onChange={setName} placeholder="rates" autoComplete="off" help="Lowercase letters, digits and underscores." />
        <TextInput label="Address" value={url} onChange={setUrl} placeholder="https://example.com/mcp" autoComplete="off" />
        <TextInput label="Bearer token (optional)" type="password" value={token} onChange={setToken} autoComplete="new-password" help="Stored encrypted and never shown again." />
      </div>
      <Button isDisabled={isBusy || !name.trim() || !url.trim()} onPress={() => void add()}>Add server</Button>
    </div>
  );
};

export default McpServersPanel;
