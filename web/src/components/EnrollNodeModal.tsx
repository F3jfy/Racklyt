import React, { useState } from 'react';
import {
  Server,
  X,
  Copy,
  Check,
  Zap,
  Info,
} from 'lucide-react';
import { ApiClient } from '../api/client';

interface EnrollNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNodeAdded?: () => void;
}

export const EnrollNodeModal: React.FC<EnrollNodeModalProps> = ({
  isOpen,
  onClose,
  onNodeAdded,
}) => {
  const [tab, setTab] = useState<'curl' | 'docker' | 'systemd' | 'quick'>('curl');
  const [copied, setCopied] = useState<string | null>(null);
  const [isSpawning, setIsSpawning] = useState(false);
  const [customNodeName, setCustomNodeName] = useState('pve-hypervisor-node');

  if (!isOpen) return null;

  const hubOrigin = window.location.origin;

  const curlCommand = `curl -sSL ${hubOrigin}/api/v1/install.sh | sudo bash -s -- --hub ${hubOrigin} --token agent_default_sec`;
  const proxmoxCommand = `curl -sSL ${hubOrigin}/api/v1/install.sh | sudo bash -s -- --hub ${hubOrigin} --tags proxmox,hypervisor,pve`;
  const dockerComposeSnippet = `version: "3.8"
services:
  racklyt-agent:
    image: ghcr.io/racklyt/agent:latest
    container_name: racklyt-agent
    restart: unless-stopped
    pid: host
    network_mode: host
    environment:
      - RACKLYT_HUB_URL=${hubOrigin}
      - RACKLYT_NODE_ID=docker-node
      - RACKLYT_AUTH_TOKEN=agent_default_sec
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/host/root:ro`;

  const systemdSnippet = `[Unit]
Description=Racklyt Telemetry Agent
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/racklyt-agent --hub-url ${hubOrigin} --token agent_default_sec
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target`;

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSpawn = async () => {
    setIsSpawning(true);
    try {
      await ApiClient.spawnTestNode({
        name: customNodeName || 'homelab-node',
        os: 'Linux (Debian 12 / Proxmox VE)',
        tags: ['homelab', 'pve', 'server'],
      });
      if (onNodeAdded) onNodeAdded();
      onClose();
    } catch (e: any) {
      alert(`Failed to spawn node: ${e.message}`);
    } finally {
      setIsSpawning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-medium)] rounded-lg w-full max-w-xl shadow-2xl flex flex-col overflow-hidden animate-scaleUp">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--racklyt-border-weak)] bg-[var(--racklyt-bg-header)] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded bg-[var(--racklyt-orange)]/20 text-[var(--racklyt-orange)]">
              <Server size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-primaryText">Add New Infrastructure Node</h2>
              <p className="text-[11px] text-mutedText">
                Connect a Linux server, Raspberry Pi, or Proxmox VE hypervisor
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-mutedText hover:text-primaryText hover:bg-[var(--racklyt-bg-subtle)] transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center border-b border-[var(--racklyt-border-weak)] px-5 pt-3 bg-[var(--racklyt-bg-subtle)] text-xs">
          <button
            onClick={() => setTab('curl')}
            className={`pb-2.5 px-3 font-semibold transition ${
              tab === 'curl'
                ? 'border-b-2 border-[var(--racklyt-orange)] text-primaryText'
                : 'text-mutedText hover:text-primaryText'
            }`}
          >
            One-Liner (Linux/Pi)
          </button>
          <button
            onClick={() => setTab('docker')}
            className={`pb-2.5 px-3 font-semibold transition ${
              tab === 'docker'
                ? 'border-b-2 border-[var(--racklyt-orange)] text-primaryText'
                : 'text-mutedText hover:text-primaryText'
            }`}
          >
            Docker Compose
          </button>
          <button
            onClick={() => setTab('systemd')}
            className={`pb-2.5 px-3 font-semibold transition ${
              tab === 'systemd'
                ? 'border-b-2 border-[var(--racklyt-orange)] text-primaryText'
                : 'text-mutedText hover:text-primaryText'
            }`}
          >
            Systemd Service
          </button>
          <button
            onClick={() => setTab('quick')}
            className={`pb-2.5 px-3 font-semibold transition ${
              tab === 'quick'
                ? 'border-b-2 border-[var(--racklyt-orange)] text-primaryText'
                : 'text-mutedText hover:text-primaryText'
            }`}
          >
            ⚡ 1-Click Test Node
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto max-h-[60vh] space-y-4 text-xs">

          {/* Explanation Info */}
          <div className="flex items-start space-x-2.5 p-3 rounded bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-weak)] text-mutedText">
            <Info size={16} className="text-[var(--racklyt-cyan)] mt-0.5 flex-shrink-0" />
            <div className="text-[11.5px] leading-relaxed">
              <strong className="text-primaryText">Agent Push Protocol:</strong> The node runs <code className="text-primaryText font-mono">racklyt-agent</code>, which reads hardware counters (<code className="text-[var(--racklyt-orange)] font-mono">/proc</code>, <code className="text-[var(--racklyt-orange)] font-mono">/sys</code>) and pushes compressed metrics to <code className="text-primaryText font-mono">{hubOrigin}</code> every 10s.
            </div>
          </div>

          {tab === 'curl' && (
            <div className="space-y-4">
              <div>
                <label className="block text-mutedText mb-1 font-medium text-[11px]">
                  Standard Linux / Raspberry Pi OS Command:
                </label>
                <div className="relative bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded p-2.5 font-mono text-primaryText">
                  <div className="overflow-x-auto pr-8">{curlCommand}</div>
                  <button
                    onClick={() => copyText(curlCommand, 'curl')}
                    className="absolute top-2 right-2 p-1 bg-[var(--racklyt-bg-subtle)] hover:bg-[var(--racklyt-bg-panel)] rounded border border-[var(--racklyt-border-weak)] text-mutedText hover:text-primaryText transition"
                  >
                    {copied === 'curl' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-mutedText mb-1 font-medium text-[11px]">
                  Proxmox VE (With Hypervisor Tags):
                </label>
                <div className="relative bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded p-2.5 font-mono text-primaryText">
                  <div className="overflow-x-auto pr-8">{proxmoxCommand}</div>
                  <button
                    onClick={() => copyText(proxmoxCommand, 'pve')}
                    className="absolute top-2 right-2 p-1 bg-[var(--racklyt-bg-subtle)] hover:bg-[var(--racklyt-bg-panel)] rounded border border-[var(--racklyt-border-weak)] text-mutedText hover:text-primaryText transition"
                  >
                    {copied === 'pve' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'docker' && (
            <div className="space-y-2">
              <label className="block text-mutedText font-medium text-[11px]">
                docker-compose.yml:
              </label>
              <div className="relative bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded p-2.5 font-mono text-primaryText">
                <pre className="overflow-x-auto text-[10.5px] leading-relaxed pr-8">{dockerComposeSnippet}</pre>
                <button
                  onClick={() => copyText(dockerComposeSnippet, 'docker')}
                  className="absolute top-2 right-2 p-1 bg-[var(--racklyt-bg-subtle)] hover:bg-[var(--racklyt-bg-panel)] rounded border border-[var(--racklyt-border-weak)] text-mutedText hover:text-primaryText transition"
                >
                  {copied === 'docker' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          )}

          {tab === 'systemd' && (
            <div className="space-y-2">
              <label className="block text-mutedText font-medium text-[11px]">
                /etc/systemd/system/racklyt-agent.service:
              </label>
              <div className="relative bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded p-2.5 font-mono text-primaryText">
                <pre className="overflow-x-auto text-[10.5px] leading-relaxed pr-8">{systemdSnippet}</pre>
                <button
                  onClick={() => copyText(systemdSnippet, 'systemd')}
                  className="absolute top-2 right-2 p-1 bg-[var(--racklyt-bg-subtle)] hover:bg-[var(--racklyt-bg-panel)] rounded border border-[var(--racklyt-border-weak)] text-mutedText hover:text-primaryText transition"
                >
                  {copied === 'systemd' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          )}

          {tab === 'quick' && (
            <div className="space-y-3 border border-[var(--racklyt-border-weak)] bg-[var(--racklyt-bg-subtle)] p-4 rounded-lg">
              <p className="text-[11.5px] text-mutedText leading-relaxed">
                Need to test fleet monitoring without spinning up a separate hardware node? Spawn an active node with live telemetry reporting instantly.
              </p>
              <div>
                <label className="block text-mutedText mb-1 font-medium text-[11px]">Node Name</label>
                <input
                  type="text"
                  value={customNodeName}
                  onChange={(e) => setCustomNodeName(e.target.value)}
                  className="w-full bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] rounded p-2 text-primaryText font-mono focus:border-[var(--racklyt-orange)] outline-none"
                  placeholder="e.g. pve-hypervisor-node"
                />
              </div>
              <button
                onClick={handleSpawn}
                disabled={isSpawning}
                className="w-full py-2 bg-[var(--racklyt-orange)] hover:bg-[var(--racklyt-orange-hover)] text-black font-semibold rounded transition flex items-center justify-center space-x-2"
              >
                <Zap size={14} />
                <span>{isSpawning ? 'Spawning node...' : 'Spawn & Register Node'}</span>
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--racklyt-border-weak)] bg-[var(--racklyt-bg-header)] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[var(--racklyt-bg-subtle)] hover:bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-weak)] rounded text-xs font-semibold text-primaryText transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
