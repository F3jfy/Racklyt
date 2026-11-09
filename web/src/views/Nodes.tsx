import React, { useState, useEffect } from 'react';
import {
  Server,
  Trash2,
  RefreshCw,
  Plus,
  Zap,
} from 'lucide-react';
import { ApiClient } from '../api/client';
import { Node } from '../types';
import { useAuth } from '../context/AuthContext';
import { EnrollNodeModal } from '../components/EnrollNodeModal';
import { NodeDeepDiveModal } from '../components/NodeDeepDiveModal';

export const Nodes: React.FC = () => {
  const { hasPermission } = useAuth();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [inspectNodeId, setInspectNodeId] = useState<string | null>(null);
  const [inspectNodeName, setInspectNodeName] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [filterTag, setFilterTag] = useState<string>('all');
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [isSpawning, setIsSpawning] = useState(false);

  const loadNodes = async () => {
    try {
      setLoading(true);
      const data = await ApiClient.getNodes();
      setNodes(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNodes();
  }, []);

  const handleInspect = (id: string) => {
    const target = nodes.find((n) => n.id === id);
    setInspectNodeId(id);
    setInspectNodeName(target?.name || id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this node from monitoring?')) return;
    try {
      await ApiClient.deleteNode(id);
      setNodes((prev) => prev.filter((n) => n.id !== id));
      if (inspectNodeId === id) setInspectNodeId(null);
    } catch (e) {
      alert('Failed to delete node.');
    }
  };

  const allTags = Array.from(new Set(nodes.flatMap((n) => n.tags)));

  const filteredNodes = nodes.filter((n) => {
    if (filterTag === 'all') return true;
    return n.tags.includes(filterTag);
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald/20 text-emerald border border-emerald/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" />
            <span>Online</span>
          </span>
        );
      case 'degraded':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-amber/20 text-amber border border-amber/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber" />
            <span>Degraded</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-coral/20 text-coral border border-coral/30">
            <span className="w-1.5 h-1.5 rounded-full bg-coral" />
            <span>Offline</span>
          </span>
        );
    }
  };

  return (
    <div className="w-full px-6 py-5 space-y-5">
      {/* Header & Tag Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-primaryText tracking-tight flex items-center space-x-2">
            <Server className="w-5 h-5 text-accent" />
            <span>Monitored Infrastructure Fleet</span>
          </h2>
          <p className="text-xs text-mutedText mt-0.5">
            Active servers, Raspberry Pi clusters, and Proxmox hypervisor nodes reporting telemetry
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <div className="flex items-center space-x-1 bg-surface border border-subtle p-1 rounded">
            <button
              onClick={() => setFilterTag('all')}
              className={`px-2.5 py-1 rounded transition ${
                filterTag === 'all' ? 'bg-elevated text-primaryText font-medium' : 'text-mutedText hover:text-primaryText'
              }`}
            >
              All ({nodes.length})
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setFilterTag(tag)}
                className={`px-2.5 py-1 rounded transition font-mono ${
                  filterTag === tag ? 'bg-elevated text-accent font-medium' : 'text-mutedText hover:text-primaryText'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowEnrollModal(true)}
            className="px-3 py-1.5 bg-[var(--racklyt-orange)] hover:bg-[var(--racklyt-orange-hover)] text-black font-semibold rounded text-xs transition flex items-center space-x-1.5 shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Node</span>
          </button>

          <button
            onClick={loadNodes}
            className="p-1.5 bg-surface hover:bg-elevated border border-subtle rounded text-mutedText hover:text-primaryText transition"
            title="Refresh Fleet"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Nodes Table or Empty State */}
      {nodes.length === 0 ? (
        <div className="bg-surface border border-subtle rounded-lg p-8 shadow-solid text-center space-y-4 max-w-xl mx-auto my-6 animate-fadeIn">
          <div className="w-12 h-12 rounded-full bg-[var(--racklyt-orange)]/15 border border-[var(--racklyt-orange)]/30 text-[var(--racklyt-orange)] flex items-center justify-center mx-auto">
            <Server size={24} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-primaryText">No Infrastructure Nodes Reporting</h3>
            <p className="text-xs text-mutedText mt-1 max-w-md mx-auto leading-relaxed">
              Connect your first Linux server, Raspberry Pi cluster, or Proxmox VE hypervisor to start aggregating hardware metrics, core load, and thermal status.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setShowEnrollModal(true)}
              className="px-4 py-2 bg-[var(--racklyt-orange)] hover:bg-[var(--racklyt-orange-hover)] text-black font-semibold text-xs rounded transition flex items-center space-x-2 shadow"
            >
              <Plus size={14} />
              <span>Add Node (Installation Guide)</span>
            </button>
            <button
              onClick={async () => {
                setIsSpawning(true);
                try {
                  await ApiClient.spawnTestNode({
                    name: 'fleet-core-node',
                    os: 'Linux (Debian 12 / Proxmox VE)',
                  });
                  await loadNodes();
                } catch (e: any) {
                  alert(e.message);
                } finally {
                  setIsSpawning(false);
                }
              }}
              disabled={isSpawning}
              className="px-4 py-2 bg-elevated hover:bg-subtle border border-subtle text-primaryText font-semibold text-xs rounded transition flex items-center space-x-2"
            >
              <Zap size={14} className="text-[var(--racklyt-orange)]" />
              <span>{isSpawning ? 'Spawning...' : '⚡ Spawn Simulated Node'}</span>
            </button>
          </div>
        </div>
      ) : (
      <div className="bg-surface border border-subtle rounded-lg overflow-hidden shadow-solid">
        <table className="w-full text-left text-xs">
          <thead className="bg-elevated text-mutedText font-semibold uppercase tracking-wider border-b border-subtle">
            <tr>
              <th className="py-3 px-4">Node Name & Host</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">OS & Architecture</th>
              <th className="py-3 px-4">IP Address</th>
              <th className="py-3 px-4">Tags</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--racklyt-border-weak)]">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-mutedText font-mono">
                  Loading infrastructure nodes...
                </td>
              </tr>
            ) : filteredNodes.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-mutedText">
                  No monitored hosts found matching the criteria.
                </td>
              </tr>
            ) : (
              filteredNodes.map((n) => (
                <tr key={n.id} className="hover:bg-[var(--racklyt-bg-active)] transition">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-primaryText">{n.name}</div>
                    <div className="text-mutedText font-mono text-[11px]">{n.hostname}</div>
                  </td>
                  <td className="py-3 px-4">{getStatusBadge(n.status)}</td>
                  <td className="py-3 px-4">
                    <div className="text-primaryText">{n.os}</div>
                    <div className="text-mutedText font-mono text-[11px]">{n.arch}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-mutedText">{n.ip_address || '—'}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {n.tags.map((t) => (
                        <span
                          key={t}
                          className="bg-elevated text-mutedText text-[10px] font-mono px-1.5 py-0.5 rounded border border-subtle"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleInspect(n.id)}
                        className="px-2.5 py-1 bg-elevated hover:bg-subtle text-primaryText rounded border border-subtle text-[11px] transition"
                      >
                        Inspect
                      </button>
                      {hasPermission('nodes:delete') && (
                        <button
                          onClick={() => handleDelete(n.id)}
                          className="p-1 hover:bg-coral/20 text-mutedText hover:text-coral rounded transition"
                          title="Remove node"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* Node Deep Dive Diagnostics & Live Process/Service Manager */}
      <NodeDeepDiveModal
        isOpen={!!inspectNodeId}
        nodeId={inspectNodeId}
        nodeName={inspectNodeName}
        onClose={() => setInspectNodeId(null)}
      />

      {/* Enroll Node Modal */}
      <EnrollNodeModal
        isOpen={showEnrollModal}
        onClose={() => setShowEnrollModal(false)}
        onNodeAdded={loadNodes}
      />
    </div>
  );
};
