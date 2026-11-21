'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Compass,
  Lock,
  Pin,
  Plus,
  Search,
  Send,
  Settings2,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { usePlatform } from '@/context/PlatformContext';
import type { ChatRoom, ChatRoomType } from '@/types/domain';

type RoomFilter = 'all' | 'direct' | 'group';

export default function MessagesWorkspace() {
  const searchParams = useSearchParams();
  const {
    currentUser,
    access,
    store,
    createChatRoom,
    ensureDirectRoomWith,
    sendChatMessage,
    markChatRoomRead,
    updateChatRoom,
    leaveOrDeleteChatRoom,
  } = usePlatform();

  const paramRoomId = searchParams.get('room');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [filter, setFilter] = useState<RoomFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Panneaux de création Groupe / Direct / Paramètres du salon
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupCoachOnly, setGroupCoachOnly] = useState(false);
  const [groupSelectedMembers, setGroupSelectedMembers] = useState<string[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);

  const [showNewDirect, setShowNewDirect] = useState(false);
  const [showRoomOptions, setShowRoomOptions] = useState(false);
  const [editPinnedText, setEditPinnedText] = useState('');
  const [editRoomName, setEditRoomName] = useState('');
  const [addMemberId, setAddMemberId] = useState('');

  // Rédaction de message
  const [draft, setDraft] = useState('');
  const [selectedRoadbookId, setSelectedRoadbookId] = useState('');
  const [showAttachPicker, setShowAttachPicker] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const visibleRooms = useMemo(() => {
    if (!currentUser) return [];
    const uid = currentUser.id;
    return store.chatRooms
      .filter((r) => access.isAdmin || r.memberIds.includes(uid))
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  }, [store.chatRooms, currentUser, access.isAdmin]);

  const getRoomDisplayName = useCallback(
    (room: ChatRoom): string => {
      if (!currentUser) return room.name;
      if (room.type !== 'direct') return room.name;
      const otherId = room.memberIds.find((id) => id !== currentUser.id);
      if (!otherId) return room.name;
      const otherUser = store.users.find((u) => u.id === otherId);
      return otherUser?.displayName || room.name;
    },
    [currentUser, store.users]
  );

  const filteredRooms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return visibleRooms.filter((room) => {
      if (filter === 'direct' && room.type !== 'direct') return false;
      if (filter === 'group' && room.type === 'direct') return false;
      if (!q) return true;
      const label = getRoomDisplayName(room).toLowerCase();
      const preview = (room.lastMessagePreview || '').toLowerCase();
      return label.includes(q) || preview.includes(q);
    });
  }, [visibleRooms, filter, searchQuery, getRoomDisplayName]);

  const activeRoomId = useMemo(() => {
    if (selectedRoomId && visibleRooms.some((r) => r.id === selectedRoomId)) {
      return selectedRoomId;
    }
    if (paramRoomId && visibleRooms.some((r) => r.id === paramRoomId)) {
      return paramRoomId;
    }
    return visibleRooms[0]?.id || null;
  }, [selectedRoomId, paramRoomId, visibleRooms]);

  const activeRoom = useMemo(
    () => visibleRooms.find((r) => r.id === activeRoomId) || null,
    [visibleRooms, activeRoomId]
  );

  const roomMessages = useMemo(() => {
    if (!activeRoom) return [];
    return store.chatMessages
      .filter((m) => m.roomId === activeRoom.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [store.chatMessages, activeRoom]);

  const markReadRef = useRef(markChatRoomRead);
  useEffect(() => {
    markReadRef.current = markChatRoomRead;
  }, [markChatRoomRead]);

  // Marquer lu avec un léger différé si ouverture directe via ?room=...
  useEffect(() => {
    if (!currentUser || !activeRoom) return;
    const unread = activeRoom.unreadBy?.[currentUser.id] || 0;
    if (unread > 0) {
      const roomId = activeRoom.id;
      const timer = setTimeout(() => {
        markReadRef.current(roomId);
      }, 180);
      return () => clearTimeout(timer);
    }
  }, [activeRoom, currentUser]);

  // Défilement automatique vers le dernier message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roomMessages.length, activeRoom?.id]);

  if (!currentUser) return null;

  const otherUsers = store.users.filter((u) => u.id !== currentUser.id);
  const myProfile = store.athleteProfiles.find((p) => p.userId === currentUser.id);
  const directContacts = access.isAdmin
    ? otherUsers
    : access.canAccessCoachDashboard
      ? otherUsers.filter((u) => {
          if (u.role === 'coach' || u.role === 'admin') return true;
          return (
            store.athleteProfiles.find((p) => p.userId === u.id)?.assignedCoachId ===
            currentUser.id
          );
        })
      : otherUsers
          .filter((u) => u.role === 'coach' || u.role === 'admin')
          .sort((a, b) => {
            if (a.id === myProfile?.assignedCoachId) return -1;
            if (b.id === myProfile?.assignedCoachId) return 1;
            return a.displayName.localeCompare(b.displayName, 'fr');
          });

  const accessibleRoadbooks = store.roadbooks.filter(
    (r) => r.userId === currentUser.id || r.isPublic || access.canAccessCoachDashboard
  );

  const canPostInActiveRoom =
    Boolean(activeRoom) &&
    (!activeRoom?.isCoachOnlyPost || access.canAccessCoachDashboard);

  const canManageActiveRoom =
    Boolean(activeRoom) &&
    (access.canAccessCoachDashboard || activeRoom?.createdBy === currentUser.id);

  const handleSelectRoom = (roomId: string) => {
    setSelectedRoomId(roomId);
    setShowRoomOptions(false);
    setSendError(null);
    markChatRoomRead(roomId);
  };

  const handleOpenRoomOptions = () => {
    if (!activeRoom) return;
    setEditRoomName(activeRoom.name);
    setEditPinnedText(activeRoom.pinnedMessage || '');
    setAddMemberId('');
    setShowRoomOptions((prev) => !prev);
  };

  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!groupName.trim()) {
      setCreateError('Veuillez indiquer un nom pour le groupe.');
      return;
    }
    const members = Array.from(new Set([currentUser.id, ...groupSelectedMembers]));
    if (members.length < 2) {
      setCreateError('Sélectionnez au moins un autre participant.');
      return;
    }

    try {
      const roomType: ChatRoomType =
        access.canAccessCoachDashboard && groupCoachOnly ? 'announcement' : 'group';
      const room = await createChatRoom({
        type: roomType,
        name: groupName.trim(),
        description: groupDesc.trim() || undefined,
        memberIds: members,
        isCoachOnlyPost: roomType === 'announcement',
      });
      setGroupName('');
      setGroupDesc('');
      setGroupSelectedMembers([]);
      setGroupCoachOnly(false);
      setShowCreateGroup(false);
      setSelectedRoomId(room.id);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Erreur création groupe.');
    }
  };

  const handleStartDirect = async (targetUserId: string) => {
    try {
      const room = await ensureDirectRoomWith(targetUserId);
      setShowNewDirect(false);
      setSelectedRoomId(room.id);
      markChatRoomRead(room.id);
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : 'Ouverture discussion impossible.');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom || !draft.trim() || sending) return;
    setSendError(null);
    setSending(true);
    try {
      const rb = selectedRoadbookId
        ? accessibleRoadbooks.find((r) => r.id === selectedRoadbookId)
        : undefined;

      await sendChatMessage({
        roomId: activeRoom.id,
        content: draft.trim(),
        attachment: rb
          ? {
              type: 'roadbook',
              label: `Roadbook : ${rb.name} (${rb.officialDistanceKm ?? '-'} km)`,
              href: '/athlete/roadbook',
            }
          : undefined,
      });
      setDraft('');
      setSelectedRoadbookId('');
      setShowAttachPicker(false);
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : "Erreur lors de l'envoi.");
    } finally {
      setSending(false);
    }
  };

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatShortDate = (iso: string) => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    } catch {
      return '';
    }
  };

  const toggleGroupMember = (uid: string) => {
    setGroupSelectedMembers((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px] lg:h-[calc(100vh-8.5rem)]">
        {/* Colonne gauche : Liste des salons & création */}
        <aside className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col bg-[#F8FAFC] min-h-0">
          <div className="p-4 border-b border-slate-200 bg-white space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-base font-bold text-[#0F172A]">Salons &amp; Groupes</h1>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewDirect((prev) => !prev);
                    setShowCreateGroup(false);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 hover:border-[#0F172A] bg-white text-[11px] font-semibold text-[#0F172A] cursor-pointer"
                >
                  <UserPlus size={12} />
                  <span>Direct</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateGroup((prev) => !prev);
                    setShowNewDirect(false);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#0F172A] hover:bg-[#FF5A36] text-[11px] font-semibold text-white cursor-pointer transition-colors"
                >
                  <Plus size={12} />
                  <span>Groupe</span>
                </button>
              </div>
            </div>

            {/* Sélecteur Direct rapide */}
            {showNewDirect && (
              <div className="rounded-md bg-[#F8FAFC] border border-slate-200 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                    Démarrer un fil direct
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNewDirect(false)}
                    className="text-slate-400 hover:text-[#0F172A] cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {directContacts.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleStartDirect(u.id)}
                      className="w-full text-left px-2.5 py-1.5 rounded bg-white border border-slate-200 hover:border-[#FF5A36] text-xs font-semibold text-[#0F172A] flex items-center justify-between cursor-pointer"
                    >
                      <span>{u.displayName}</span>
                      <span className="font-mono text-[10px] uppercase text-slate-400">
                        {u.role === 'coach' || u.role === 'admin' ? 'COACH' : 'ATHLÈTE'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Création de groupe */}
            {showCreateGroup && (
              <form
                onSubmit={handleCreateGroupSubmit}
                className="rounded-md bg-[#F8FAFC] border border-slate-200 p-3 space-y-2.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#FF5A36] font-semibold">
                    Nouveau groupe trail
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCreateGroup(false)}
                    className="text-slate-400 hover:text-[#0F172A] cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                </div>

                {createError && (
                  <p className="text-[11px] text-red-700 font-semibold">{createError}</p>
                )}

                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Nom (ex: Team UTMB 2027)"
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#0F172A]"
                />
                <input
                  type="text"
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder="Description courte (optionnel)"
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#0F172A]"
                />

                {access.canAccessCoachDashboard && (
                  <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={groupCoachOnly}
                      onChange={(e) => setGroupCoachOnly(e.target.checked)}
                      className="accent-[#FF5A36]"
                    />
                    <span>Canal annonces (seul le coach écrit)</span>
                  </label>
                )}

                <div className="space-y-1 max-h-32 overflow-y-auto pt-1">
                  <p className="font-mono text-[10px] uppercase text-slate-400">
                    Participants ({groupSelectedMembers.length + 1})
                  </p>
                  {otherUsers.map((u) => (
                    <label
                      key={u.id}
                      className="flex items-center gap-2 px-2 py-1 rounded bg-white border border-slate-200 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={groupSelectedMembers.includes(u.id)}
                        onChange={() => toggleGroupMember(u.id)}
                        className="accent-[#0F172A]"
                      />
                      <span className="truncate font-medium text-[#0F172A]">{u.displayName}</span>
                    </label>
                  ))}
                </div>

                <button
                  type="submit"
                  className="w-full py-2 rounded bg-[#0F172A] hover:bg-[#FF5A36] text-white font-semibold text-xs cursor-pointer transition-colors"
                >
                  Créer le groupe
                </button>
              </form>
            )}

            {/* Recherche & Filtres */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un athlète ou groupe..."
                className="w-full rounded-md border border-slate-200 bg-[#F8FAFC] pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-[#0F172A]"
              />
            </div>

            <div className="flex border-b border-slate-200 gap-4 pt-1">
              {(
                [
                  { id: 'all', label: 'Tous' },
                  { id: 'direct', label: 'Direct' },
                  { id: 'group', label: 'Groupes' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`pb-1.5 text-[11px] font-semibold border-b-2 cursor-pointer transition-colors ${
                    filter === tab.id
                      ? 'border-[#FF5A36] text-[#0F172A]'
                      : 'border-transparent text-slate-500 hover:text-[#0F172A]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
            {filteredRooms.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Aucun salon trouvé.
              </div>
            ) : (
              filteredRooms.map((room) => {
                const isSelected = activeRoom?.id === room.id;
                const unread = room.unreadBy?.[currentUser.id] || 0;
                const displayName = getRoomDisplayName(room);
                const badgeLabel =
                  room.type === 'announcement'
                    ? 'ANNONCES'
                    : room.type === 'group'
                    ? 'GROUPE'
                    : 'DIRECT';

                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => handleSelectRoom(room.id)}
                    className={`w-full text-left px-4 py-3.5 transition-colors cursor-pointer ${
                      isSelected ? 'bg-white border-l-2 border-l-[#FF5A36]' : 'hover:bg-white/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                        {badgeLabel}
                      </span>
                      <div className="flex items-center gap-2">
                        {unread > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-[#FF5A36] text-white font-mono text-[10px] font-bold tabular-nums">
                            {unread}
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                          {formatShortDate(room.lastMessageAt)} {formatTime(room.lastMessageAt)}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-[#0F172A] truncate mt-0.5">
                      {displayName}
                    </p>
                    {room.lastMessagePreview && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {room.lastMessagePreview}
                      </p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Colonne droite : Fil actif */}
        <section className="lg:col-span-8 flex flex-col bg-white min-h-0">
          {!activeRoom ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <Users size={28} className="text-slate-300" />
              <p className="text-sm font-semibold text-[#0F172A]">
                Sélectionnez un échange ou créez un groupe d&apos;entraînement
              </p>
              <p className="text-xs text-slate-500 max-w-sm">
                Échangez directement avec votre coach, animez un groupe d&apos;objectif ou partagez un roadbook GPX.
              </p>
            </div>
          ) : (
            <>
              {/* En-tête du salon actif */}
              <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[#0F172A] truncate">
                      {getRoomDisplayName(activeRoom)}
                    </h2>
                    {activeRoom.isCoachOnlyPost && (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        <Lock size={10} /> Coach écrit seul
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-[11px] text-slate-400 mt-0.5">
                    {activeRoom.memberIds.length} participant
                    {activeRoom.memberIds.length > 1 ? 's' : ''}
                    {activeRoom.description ? ` · ${activeRoom.description}` : ''}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleOpenRoomOptions}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 hover:border-[#0F172A] text-xs font-semibold text-[#0F172A] cursor-pointer"
                >
                  <Settings2 size={13} />
                  <span>Membres &amp; Options</span>
                </button>
              </div>

              {/* Panneau Membres & Options */}
              {showRoomOptions && (
                <div className="px-5 py-4 bg-[#F8FAFC] border-b border-slate-200 space-y-4 text-xs">
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="font-mono text-[10px] uppercase text-slate-400 mr-1">
                      Membres :
                    </span>
                    {activeRoom.memberIds.map((uid) => {
                      const u = store.users.find((usr) => usr.id === uid);
                      const canKick =
                        canManageActiveRoom &&
                        activeRoom.type !== 'direct' &&
                        uid !== activeRoom.createdBy;
                      return (
                        <span
                          key={uid}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white border border-slate-200 font-semibold text-[#0F172A]"
                        >
                          <span>{u?.displayName || uid}</span>
                          {canKick && (
                            <button
                              type="button"
                              onClick={() =>
                                updateChatRoom(activeRoom.id, {
                                  memberIds: activeRoom.memberIds.filter((id) => id !== uid),
                                })
                              }
                              className="text-slate-400 hover:text-red-600 cursor-pointer"
                              title="Retirer du groupe"
                            >
                              <X size={11} />
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>

                  {canManageActiveRoom && activeRoom.type !== 'direct' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                      <div>
                        <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                          Renommer le groupe
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={editRoomName}
                            onChange={(e) => setEditRoomName(e.target.value)}
                            className="flex-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (editRoomName.trim().length >= 2) {
                                updateChatRoom(activeRoom.id, { name: editRoomName.trim() });
                              }
                            }}
                            className="px-2.5 py-1 rounded bg-[#0F172A] text-white font-semibold cursor-pointer"
                          >
                            OK
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                          Ajouter un membre
                        </label>
                        <div className="flex gap-1.5">
                          <select
                            value={addMemberId}
                            onChange={(e) => setAddMemberId(e.target.value)}
                            className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                          >
                            <option value="">Choisir...</option>
                            {store.users
                              .filter((u) => !activeRoom.memberIds.includes(u.id))
                              .map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.displayName}
                                </option>
                              ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              if (!addMemberId) return;
                              updateChatRoom(activeRoom.id, {
                                memberIds: [...activeRoom.memberIds, addMemberId],
                              });
                              setAddMemberId('');
                            }}
                            className="px-2.5 py-1 rounded bg-[#14C38E] text-[#0F172A] font-bold cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block font-mono text-[10px] uppercase text-slate-400 mb-1">
                          Consigne épinglée
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={editPinnedText}
                            onChange={(e) => setEditPinnedText(e.target.value)}
                            placeholder="Message épinglé..."
                            className="flex-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateChatRoom(activeRoom.id, {
                                pinnedMessage: editPinnedText.trim() || undefined,
                              })
                            }
                            className="px-2.5 py-1 rounded bg-[#0F172A] text-white font-semibold cursor-pointer"
                          >
                            Épingler
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeRoom.type !== 'direct' && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          leaveOrDeleteChatRoom(activeRoom.id);
                          setShowRoomOptions(false);
                          setSelectedRoomId(null);
                        }}
                        className="inline-flex items-center gap-1.5 text-red-700 hover:underline font-semibold cursor-pointer"
                      >
                        <Trash2 size={12} />
                        <span>
                          {canManageActiveRoom ? 'Supprimer ce groupe' : 'Quitter le groupe'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Consigne épinglée */}
              {activeRoom.pinnedMessage && (
                <div className="px-5 py-2.5 bg-[#F8FAFC] border-b border-slate-200 border-l-2 border-l-[#14C38E] flex items-center gap-2 text-xs text-[#0F172A]">
                  <Pin size={13} className="text-[#14C38E] shrink-0" />
                  <span className="font-medium">{activeRoom.pinnedMessage}</span>
                </div>
              )}

              {/* Fil des messages */}
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-[#F8FAFC]/60">
                {roomMessages.length === 0 ? (
                  <p className="text-center font-mono text-xs text-slate-400 py-8">
                    Aucun message dans ce salon. Démarrez la conversation ci-dessous.
                  </p>
                ) : (
                  roomMessages.map((msg) => {
                    const isMine = msg.senderId === currentUser.id;
                    const isCoachMsg = msg.senderRole === 'coach' || msg.senderRole === 'admin';
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-2 mb-1 px-1">
                          <span className="text-xs font-bold text-[#0F172A]">
                            {isMine ? 'Vous' : msg.senderName}
                          </span>
                          {isCoachMsg && (
                            <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#FF5A36]/10 text-[#FF5A36] font-semibold">
                              COACH
                            </span>
                          )}
                          <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                            {formatShortDate(msg.createdAt)} {formatTime(msg.createdAt)}
                          </span>
                        </div>

                        <div
                          className={`max-w-[82%] rounded-lg px-4 py-3 text-sm leading-relaxed space-y-2 ${
                            isMine
                              ? 'bg-[#0F172A] text-white'
                              : 'bg-white border border-slate-200 text-[#0F172A]'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>

                          {msg.attachment && (
                            <Link
                              href={msg.attachment.href || '/athlete/roadbook'}
                              className={`flex items-center gap-2 px-3 py-2 rounded border text-xs font-semibold transition-colors ${
                                isMine
                                  ? 'bg-slate-800 border-slate-700 text-[#14C38E] hover:border-[#14C38E]'
                                  : 'bg-[#F8FAFC] border-slate-200 text-[#0F172A] hover:border-[#FF5A36]'
                              }`}
                            >
                              <Compass size={13} className="shrink-0" />
                              <span>{msg.attachment.label}</span>
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Zone d'envoi */}
              <div className="p-4 border-t border-slate-200 bg-white space-y-2.5">
                {sendError && (
                  <p className="text-xs font-semibold text-red-700">{sendError}</p>
                )}

                {!canPostInActiveRoom ? (
                  <div className="px-3 py-2.5 rounded-md bg-[#F8FAFC] border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
                    <Lock size={13} />
                    <span>
                      Canal en lecture seule réservé aux annonces du coach.
                    </span>
                  </div>
                ) : (
                  <form onSubmit={handleSendMessage} className="space-y-2">
                    {showAttachPicker && (
                      <div className="flex items-center gap-2 p-2 rounded bg-[#F8FAFC] border border-slate-200 text-xs">
                        <Compass size={14} className="text-[#FF5A36] shrink-0" />
                        <select
                          value={selectedRoadbookId}
                          onChange={(e) => setSelectedRoadbookId(e.target.value)}
                          className="flex-1 bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                        >
                          <option value="">Aucun roadbook joint</option>
                          {accessibleRoadbooks.map((rb) => (
                            <option key={rb.id} value={rb.id}>
                              {rb.name} ({rb.officialDistanceKm ?? '-'} km)
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAttachPicker(false);
                            setSelectedRoadbookId('');
                          }}
                          className="text-slate-400 hover:text-[#0F172A] cursor-pointer"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    )}

                    <div className="flex items-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAttachPicker((prev) => !prev)}
                        className={`p-2.5 rounded-md border text-xs cursor-pointer transition-colors shrink-0 ${
                          selectedRoadbookId
                            ? 'border-[#14C38E] bg-emerald-50 text-[#047857]'
                            : 'border-slate-300 text-slate-600 hover:border-[#0F172A]'
                        }`}
                        title="Joindre un roadbook GPX"
                        aria-label="Joindre un roadbook GPX"
                      >
                        <Compass size={16} />
                      </button>

                      <textarea
                        rows={1}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void handleSendMessage(e);
                          }
                        }}
                        placeholder="Écrire un message (Entrée pour envoyer, Maj+Entrée pour nouvelle ligne)..."
                        className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#0F172A]"
                      />

                      <button
                        type="submit"
                        disabled={sending || !draft.trim()}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md bg-[#FF5A36] hover:bg-[#E34A28] text-white text-xs font-semibold disabled:opacity-50 cursor-pointer shrink-0 transition-colors"
                      >
                        <Send size={14} />
                        <span className="hidden sm:inline">
                          {sending ? 'Envoi...' : 'Envoyer'}
                        </span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
