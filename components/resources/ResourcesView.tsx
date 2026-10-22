'use client';

import React, { useState } from 'react';
import {
  PhoneCall,
  Mail,
  MapPin,
  Plus,
  AlertTriangle,
  Scale,
  HeartHandshake,
  Stethoscope,
  Pill,
  Bus,
  ShieldAlert,
  Trash2,
  Copy,
  Check,
} from 'lucide-react';
import { useDayBridge } from '../../lib/storage/store';
import { ResourceContact } from '../../lib/types';

interface ResourcesViewProps {
  onOpenQuickAdd: () => void;
}

export const ResourcesView: React.FC<ResourcesViewProps> = ({ onOpenQuickAdd }) => {
  const { contacts, deleteContact } = useDayBridge();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const emergencyContacts = contacts.filter((c) => c.isEmergency);
  const regularContacts = contacts.filter((c) => !c.isEmergency);

  const categoryIcons: Record<string, any> = {
    court: Scale,
    therapist: HeartHandshake,
    doctor: Stethoscope,
    pharmacy: Pill,
    case_manager: Scale,
    transport: Bus,
    emergency: ShieldAlert,
    other: PhoneCall,
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Title & Add Contact */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Personal Resources & Contacts</h2>
          <p className="text-xs text-slate-600">
            Saved direct contacts for court, counseling, healthcare, and emergency
          </p>
        </div>
        <button
          onClick={onOpenQuickAdd}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs min-h-[44px] transition shadow-md shadow-teal-100/70"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Contact</span>
        </button>
      </div>

      {/* Emergency & Crisis Support Cards */}
      <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-3xl space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-400" />
          <h3 className="font-bold text-sm text-rose-200">24/7 Crisis & Immediate Support</h3>
        </div>
        <p className="text-xs text-rose-200/80">
          Confidential and free support if feeling overwhelmed, in distress, or in an emergency.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <div className="p-3 bg-slate-50/90 rounded-xl border border-rose-900/60 flex items-center justify-between">
            <div>
              <span className="font-bold text-sm text-slate-900 block">988 Lifeline</span>
              <span className="text-[11px] text-slate-600">Suicide & Crisis Helpline (Call or Text)</span>
            </div>
            <a
              href="tel:988"
              className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs min-h-[44px] flex items-center gap-1.5"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Call 988</span>
            </a>
          </div>

          <div className="p-3 bg-slate-50/90 rounded-xl border border-rose-900/60 flex items-center justify-between">
            <div>
              <span className="font-bold text-sm text-slate-900 block">Crisis Text Line</span>
              <span className="text-[11px] text-slate-600">Text HOME to 741741</span>
            </div>
            <a
              href="sms:741741"
              className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-rose-300 font-bold text-xs min-h-[44px] flex items-center gap-1.5"
            >
              <span>Text</span>
            </a>
          </div>
        </div>
      </div>

      {/* 1. PERSONAL SAVED DIRECT CONTACTS */}
      <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-lg">
        <div className="mb-4">
          <h3 className="font-bold text-slate-900 text-base">Saved Contacts</h3>
          <p className="text-xs text-slate-600">Private personal list; no data is shared externally</p>
        </div>

        {regularContacts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {regularContacts.map((contact) => {
              const Icon = categoryIcons[contact.category] || PhoneCall;
              return (
                <div
                  key={contact.id}
                  className="p-4 bg-slate-50/90 border border-slate-200 rounded-2xl flex flex-col justify-between"
                >
                  <div className="mb-3">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-slate-100 text-teal-700">
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-sm text-slate-900">{contact.name}</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {contact.category.replace('_', ' ')}
                      </span>
                    </div>

                    {contact.notes && (
                      <p className="text-xs text-slate-600 mb-2 pl-8">{contact.notes}</p>
                    )}

                    {contact.address && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600 pl-8 mb-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        <span>{contact.address}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <div className="flex items-center gap-2">
                      {contact.phone && (
                        <a
                          href={`tel:${contact.phone}`}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 text-teal-800 font-semibold text-xs min-h-[44px]"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                          <span>Call</span>
                        </a>
                      )}
                      {contact.email && (
                        <a
                          href={`mailto:${contact.email}`}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs min-h-[44px]"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>Email</span>
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {contact.phone && (
                        <button
                          onClick={() => handleCopy(contact.phone || '', contact.id)}
                          className="p-2 text-slate-600 hover:text-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="Copy phone"
                        >
                          {copiedId === contact.id ? (
                            <Check className="w-4 h-4 text-emerald-700" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => deleteContact(contact.id)}
                        className="p-2 text-slate-600 hover:text-rose-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="Delete contact"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-600 py-4 text-center">No contacts added yet.</p>
        )}
      </section>
    </div>
  );
};
