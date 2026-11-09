import React, { useState } from 'react';
import {
  X,
  Server,
  Layers,
  Activity,
  Zap,
  Globe,
  HardDrive,
  Cpu,
  Palette,
  BookOpen,
} from 'lucide-react';

interface HelpDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpDocsModal: React.FC<HelpDocsModalProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState<
    'arch' | 'nodes' | 'proxmox' | 'dashboards' | 'alerts' | 'remote'
  >('arch');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-[var(--racklyt-bg-panel)] border border-[var(--racklyt-border-medium)] rounded-lg w-full max-w-4xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-scaleUp">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--racklyt-border-weak)] bg-[var(--racklyt-bg-header)] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded bg-[var(--racklyt-orange)]/20 text-[var(--racklyt-orange)]">
              <BookOpen size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-primaryText flex items-center space-x-2">
                <span>Racklyt Operator Guide & Architecture Documentation</span>
              </h2>
              <p className="text-[11px] text-mutedText">
                Complete guide to how Racklyt operates, collects telemetry, and configures watchdogs
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

        {/* Main Body with Sidebar Navigation */}
        <div className="flex flex-1 overflow-hidden">
          {/* Side Tabs */}
          <div className="w-56 border-r border-[var(--racklyt-border-weak)] bg-[var(--racklyt-bg-subtle)] p-3 space-y-1 text-xs">
            {[
              { id: 'arch', label: '1. Architecture & Engine', icon: <Zap size={14} className="text-[var(--racklyt-orange)]" /> },
              { id: 'nodes', label: '2. Adding Nodes & Agent', icon: <Server size={14} className="text-[var(--racklyt-cyan)]" /> },
              { id: 'proxmox', label: '3. Proxmox VE Hypervisors', icon: <Layers size={14} className="text-[var(--racklyt-purple)]" /> },
              { id: 'dashboards', label: '4. Dashboards & Icons', icon: <Palette size={14} className="text-[var(--racklyt-yellow)]" /> },
              { id: 'alerts', label: '5. Alerts & Watchdogs', icon: <Activity size={14} className="text-[var(--racklyt-red)]" /> },
              { id: 'remote', label: '6. Remote Access & Ingress', icon: <Globe size={14} className="text-[var(--racklyt-blue)]" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as any)}
                className={`w-full text-left px-3 py-2 rounded flex items-center space-x-2.5 transition ${
                  activeSection === tab.id
                    ? 'bg-[var(--racklyt-bg-active)] text-primaryText font-semibold border border-[var(--racklyt-border-medium)]'
                    : 'text-mutedText hover:text-primaryText hover:bg-[var(--racklyt-bg-panel)]'
                }`}
              >
                {tab.icon}
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Docs Content */}
          <div className="flex-1 p-6 overflow-y-auto text-xs space-y-5 leading-relaxed text-secondaryText">

            {/* SECTION 1: Architecture */}
            {activeSection === 'arch' && (
              <div className="space-y-4 animate-fadeIn">
                <h3 className="text-sm font-bold text-primaryText flex items-center space-x-2">
                  <Zap size={16} className="text-[var(--racklyt-orange)]" />
                  <span>How Racklyt Works: Push Telemetry Architecture</span>
                </h3>
                
                <p>
                  Racklyt is engineered as a modern, lightweight alternative to resource-heavy monitoring stacks. Instead of running Prometheus scrapers that consume several gigabytes of RAM and constantly hammer slow SD cards, Racklyt employs a lean <strong>Hub-and-Spoke Push Architecture</strong>:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] space-y-1.5">
                    <div className="font-semibold text-primaryText text-xs flex items-center space-x-1.5">
                      <Cpu size={13} className="text-[var(--racklyt-orange)]" />
                      <span>The Telemetry Agent (<code className="font-mono">racklyt-agent</code>)</span>
                    </div>
                    <p className="text-[11px] text-mutedText">
                      A standalone native binary compiled in Rust with zero runtime dependencies (no Python, no Node, no Java). It directly reads kernel files (<code className="text-primaryText font-mono">/proc/stat</code>, <code className="text-primaryText font-mono">/proc/meminfo</code>, <code className="text-primaryText font-mono">/proc/net/dev</code>, <code className="text-primaryText font-mono">/sys/class/thermal</code>) using near-zero CPU (&lt;0.1%) and pushes compressed payloads to the Hub.
                    </p>
                  </div>

                  <div className="p-3 rounded bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] space-y-1.5">
                    <div className="font-semibold text-primaryText text-xs flex items-center space-x-1.5">
                      <HardDrive size={13} className="text-emerald-400" />
                      <span>Embedded SQLite WAL Storage</span>
                    </div>
                    <p className="text-[11px] text-mutedText">
                      All telemetry is recorded into an embedded SQLite database using <strong>Write-Ahead Logging (WAL)</strong> and memory-mapped pages. This writes sequential append-only logs that protect flash memory (such as Raspberry Pi microSD cards) from random write wear.
                    </p>
                  </div>
                </div>

                <div className="border-t border-[var(--racklyt-border-weak)] pt-3 space-y-2">
                  <h4 className="font-semibold text-primaryText text-xs">Realtime WebSocket Streaming</h4>
                  <p className="text-mutedText">
                    Whenever an agent pushes a metric packet, the Hub's broadcast engine transmits a <code className="text-[var(--racklyt-cyan)] font-mono">metric_tick</code> event over WebSocket to all open browser windows, causing gauges and charts to react instantly without requiring full-page reloads.
                  </p>
                </div>
              </div>
            )}

            {/* SECTION 2: Nodes & Agent */}
            {activeSection === 'nodes' && (
              <div className="space-y-4 animate-fadeIn">
                <h3 className="text-sm font-bold text-primaryText flex items-center space-x-2">
                  <Server size={16} className="text-[var(--racklyt-cyan)]" />
                  <span>Adding Servers, Raspberry Pis, and Nodes</span>
                </h3>

                <p>
                  Adding a machine to your Racklyt fleet takes under 15 seconds. You do not need to pre-register hostnames on the Hub: new agents auto-enroll on their very first heartbeat.
                </p>

                <div className="p-3 rounded bg-[var(--racklyt-bg-input)] border border-[var(--racklyt-border-medium)] space-y-2 font-mono text-[11px]">
                  <div className="text-mutedText"># 1. Install & launch on any Debian, Ubuntu, or Raspberry Pi OS host:</div>
                  <div className="text-[var(--racklyt-orange)]">
                    curl -sSL http://&lt;HUB_IP&gt;:8443/install.sh | sudo bash -s -- --hub http://&lt;HUB_IP&gt;:8443
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-primaryText text-xs">Supported Environments</h4>
                  <ul className="list-disc list-inside space-y-1 text-mutedText text-[11.5px]">
                    <li><strong className="text-primaryText">Raspberry Pi (Raspbian 11/12):</strong> Reads Broadcom BCM SoC thermal sensor, NVMe hats, and micro-SD mounts.</li>
                    <li><strong className="text-primaryText">Debian & Ubuntu Servers:</strong> Reads system load, cgroups, network interfaces, and systemd units.</li>
                    <li><strong className="text-primaryText">Proxmox VE 8.x:</strong> Reads physical hypervisor stats, ZFS pools, and QEMU guests.</li>
                    <li><strong className="text-primaryText">Docker Containers:</strong> Can be run as a container with host pid and network mounts.</li>
                  </ul>
                </div>

                <div className="border-t border-[var(--racklyt-border-weak)] pt-3 space-y-1.5">
                  <h4 className="font-semibold text-primaryText text-xs">Node Tagging & Scoping</h4>
                  <p className="text-mutedText">
                    You can tag nodes during installation (e.g. <code className="text-primaryText font-mono">--tags production,proxmox,storage</code>). In the <strong>Users & RBAC</strong> tab, you can restrict specific user accounts so they can only view nodes matching designated tags!
                  </p>
                </div>
              </div>
            )}

            {/* SECTION 3: Proxmox VE */}
            {activeSection === 'proxmox' && (
              <div className="space-y-4 animate-fadeIn">
                <h3 className="text-sm font-bold text-primaryText flex items-center space-x-2">
                  <Layers size={16} className="text-[var(--racklyt-purple)]" />
                  <span>Proxmox VE Hypervisors, VMs & Storage Pools</span>
                </h3>

                <p>
                  Racklyt provides first-class support for Proxmox VE 7.x and 8.x virtualization clusters:
                </p>

                <div className="space-y-3">
                  <div className="p-3 rounded bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] space-y-1">
                    <div className="font-semibold text-primaryText text-xs">Method 1: Native Agent on PVE Host (Recommended)</div>
                    <p className="text-mutedText text-[11px]">
                      Install <code className="text-primaryText font-mono">racklyt-agent</code> directly in the Proxmox VE host root shell. Because it runs with root privileges on the Debian host, it automatically reads physical CPU cores, NUMA topology, ZFS ARC memory allocations, and QEMU VM metrics with 0 API rate limits.
                    </p>
                  </div>

                  <div className="p-3 rounded bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] space-y-1">
                    <div className="font-semibold text-primaryText text-xs">Virtual Machine & Container Telemetry</div>
                    <p className="text-mutedText text-[11px]">
                      The Proxmox VE view provides individual VM and LXC status tables showing VMID, allocated vCPUs, memory consumption, virtual disk I/O, and bridge network throughput with live power actions (start, stop, reboot).
                    </p>
                  </div>

                  <div className="p-3 rounded bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] space-y-1">
                    <div className="font-semibold text-primaryText text-xs">ZFS Pools & LVM-Thin Mounts</div>
                    <p className="text-mutedText text-[11px]">
                      Monitors pool fragmentation, read/write error counts, ZFS ARC cache hit ratios, and storage volume saturation.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 4: Dashboards & Customization */}
            {activeSection === 'dashboards' && (
              <div className="space-y-4 animate-fadeIn">
                <h3 className="text-sm font-bold text-primaryText flex items-center space-x-2">
                  <Palette size={16} className="text-[var(--racklyt-yellow)]" />
                  <span>Multi-Dashboard Suites & Custom Icon Studio</span>
                </h3>

                <p>
                  Racklyt gives you complete flexibility to tailor your monitoring workspace:
                </p>

                <div className="space-y-2.5">
                  <div className="p-3 rounded bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] space-y-1">
                    <strong className="text-primaryText text-xs">5 Out-of-the-Box Operational Suites:</strong>
                    <ul className="list-disc list-inside text-mutedText text-[11px] space-y-0.5">
                      <li><strong>Infrastructure Overview:</strong> CPU gauges, host specs, core breakdown, system journals.</li>
                      <li><strong>Proxmox VE:</strong> Hypervisor cluster nodes, VMs, LXC containers, ZFS pools.</li>
                      <li><strong>Network Hub:</strong> Interface throughput, listening sockets, ping matrix.</li>
                      <li><strong>Hardware Thermals:</strong> Broadcom SoC sensors, package thermals, core allocation.</li>
                      <li><strong>Docker Fleet:</strong> Container status, CPU/RAM limits, port bindings.</li>
                    </ul>
                  </div>

                  <div className="p-3 rounded bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] space-y-1">
                    <strong className="text-primaryText text-xs">Pinning to Sidebar Dock:</strong>
                    <p className="text-mutedText text-[11px]">
                      Click the yellow star <span className="text-yellow-400">★</span> in the top navbar breadcrumb to pin your favorite dashboards directly onto the left sidebar dock for one-click access.
                    </p>
                  </div>

                  <div className="p-3 rounded bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] space-y-1">
                    <strong className="text-primaryText text-xs">Custom Icon & Color Studio:</strong>
                    <p className="text-mutedText text-[11px]">
                      Right-click any pinned icon on the left sidebar to open the <strong>Icon Studio</strong>! You can pick from 26 system icons and 8 operations color palettes. You can also customize individual panel icons by clicking the icon in the panel editor.
                    </p>
                  </div>

                  <div className="p-3 rounded bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] space-y-1">
                    <strong className="text-primaryText text-xs">Edit Mode & Drag-and-Drop Grid:</strong>
                    <p className="text-mutedText text-[11px]">
                      Click <strong>Edit</strong> in the top navbar to enter grid design mode. You can expand widget widths (+ / -), move panels left or right, add new panels from templates, and customize thresholds.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 5: Alerts & Watchdogs */}
            {activeSection === 'alerts' && (
              <div className="space-y-4 animate-fadeIn">
                <h3 className="text-sm font-bold text-primaryText flex items-center space-x-2">
                  <Activity size={16} className="text-[var(--racklyt-red)]" />
                  <span>Dead-Man Watchdogs & Alert Channels</span>
                </h3>

                <p>
                  Racklyt monitors your homelab continuously and delivers notifications when critical thresholds are breached:
                </p>

                <div className="space-y-3">
                  <div className="p-3 rounded bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] space-y-1">
                    <div className="font-semibold text-primaryText text-xs">Dead-Man's Switch (Heartbeat Lost)</div>
                    <p className="text-mutedText text-[11px]">
                      If a node fails to push telemetry for over 30 seconds (power failure, kernel panic, or network disruption), the Hub's background watchdog immediately triggers a <strong className="text-red-400">CRITICAL</strong> alert: <code className="font-mono text-primaryText">Node Offline: [hostname]</code>.
                    </p>
                  </div>

                  <div className="p-3 rounded bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] space-y-1">
                    <div className="font-semibold text-primaryText text-xs">Hardware Thermal & SoC Watchdogs</div>
                    <p className="text-mutedText text-[11px]">
                      Monitors Raspberry Pi Broadcom SoC and server CPU package temperatures. Emits warnings at 75°C and critical throttle alerts at 85°C.
                    </p>
                  </div>

                  <div className="p-3 rounded bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] space-y-1">
                    <div className="font-semibold text-primaryText text-xs">Notification Channels Supported</div>
                    <ul className="list-disc list-inside text-mutedText text-[11px] space-y-0.5">
                      <li><strong>Outgoing SMTP:</strong> Delivers formatted email alerts with TLS/STARTTLS support.</li>
                      <li><strong>Discord Webhooks:</strong> Posts alert embeds with role mentions to dedicated Discord channels.</li>
                      <li><strong>Telegram Bots:</strong> Sends instant chat messages to your personal chat or group topic.</li>
                      <li><strong>Mobile App Stream:</strong> Realtime Server-Sent Events (SSE) feed for the companion app.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 6: Remote Access & Ingress */}
            {activeSection === 'remote' && (
              <div className="space-y-4 animate-fadeIn">
                <h3 className="text-sm font-bold text-primaryText flex items-center space-x-2">
                  <Globe size={16} className="text-[var(--racklyt-blue)]" />
                  <span>Cloudflare Zero-Trust & Remote Ingress</span>
                </h3>

                <p>
                  Exposing your homelab to the public internet should never require opening inbound ports on your home router:
                </p>

                <div className="space-y-3">
                  <div className="p-3 rounded bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] space-y-1.5">
                    <strong className="text-primaryText text-xs">Cloudflare Tunnels (<code className="font-mono text-primaryText">cloudflared</code>)</strong>
                    <p className="text-mutedText text-[11px]">
                      Install <code className="text-primaryText font-mono">cloudflared</code> on your Raspberry Pi or Hub server. It establishes an outbound encrypted tunnel to Cloudflare edge nodes, routing your custom domain (e.g. <code className="text-primaryText font-mono">racklyt.homelab.org</code>) securely to <code className="text-primaryText font-mono">http://localhost:8443</code>.
                    </p>
                  </div>

                  <div className="p-3 rounded bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] space-y-1.5">
                    <strong className="text-primaryText text-xs">Trusted Reverse Proxy Headers</strong>
                    <p className="text-mutedText text-[11px]">
                      Racklyt inspects <code className="text-primaryText font-mono">CF-Connecting-IP</code> and <code className="text-primaryText font-mono">X-Forwarded-For</code> to accurately log operator client IPs while preserving Argon2id session security.
                    </p>
                  </div>

                  <div className="p-3 rounded bg-[var(--racklyt-bg-subtle)] border border-[var(--racklyt-border-weak)] space-y-1.5">
                    <strong className="text-primaryText text-xs">Tailscale Mesh VPN</strong>
                    <p className="text-mutedText text-[11px]">
                      Alternatively, connect your Hub to Tailscale to access the cockpit securely over your private WireGuard-based tailnet with Zero-Trust access controls.
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[var(--racklyt-border-weak)] bg-[var(--racklyt-bg-header)] flex items-center justify-between text-xs">
          <span className="text-mutedText font-mono text-[11px]">
            Racklyt Knowledge Base • Version 1.4
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[var(--racklyt-orange)] hover:bg-[var(--racklyt-orange-hover)] text-black font-semibold rounded transition"
          >
            Got it, Back to Cockpit
          </button>
        </div>

      </div>
    </div>
  );
};
