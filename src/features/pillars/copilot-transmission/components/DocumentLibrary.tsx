"use client";

import { FileText, Trash2 } from "lucide-react";

interface Document {
  id: string;
  name: string;
  created_at: string;
  full_text: string;
}

interface DocumentLibraryProps {
  documents: Document[];
  onDocumentSelect: (doc: Document) => void;
  onDocumentDelete: (docId: string, e: React.MouseEvent) => void;
}

export function DocumentLibrary({ 
  documents, 
  onDocumentSelect, 
  onDocumentDelete 
}: DocumentLibraryProps) {
  return (
    <div className="max-w-4xl mx-auto py-10 animate-in fade-in duration-500 text-white">
      <h1 className="text-4xl font-extrabold mb-10 text-white italic uppercase tracking-tighter">
        Archives
      </h1>
      {documents.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 p-12 rounded-[2rem] text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-slate-800/50 rounded-2xl">
              <FileText size={32} className="text-slate-500" />
            </div>
          </div>
          <p className="text-slate-400 text-lg font-medium mb-2">
            Aucun document dans les archives
          </p>
          <p className="text-slate-500 text-sm">
            Les documents que vous uploadez lors de vos conversations seront disponibles ici
          </p>
        </div>
      ) : (
        <div className="grid gap-4 text-white">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="bg-slate-900/40 border border-slate-800 p-6 rounded-[2rem] flex justify-between items-center group hover:bg-slate-900/80 transition-all"
            >
              <div
                className="flex items-center gap-5 cursor-pointer"
                onClick={() => onDocumentSelect(doc)}
              >
                <div className="p-4 bg-cyan-600/10 rounded-2xl text-cyan-400">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="font-bold">{doc.name}</p>
                  <p className="text-[9px] text-slate-500 uppercase mt-1 tracking-widest">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDocumentDelete(doc.id, e);
                }}
                className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

