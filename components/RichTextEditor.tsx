'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Bold, Italic, Underline, List, ListOrdered, Link as LinkIcon, Type } from 'lucide-react';
import { useEffect } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  readOnly?: boolean;
  minHeight?: string;
}

export default function RichTextEditor({ content, onChange, readOnly = false, minHeight = '160px' }: RichTextEditorProps) {
  const editor = useEditor({
    editable: !readOnly,
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
      }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    // Required to prevent hydration mismatch for Tiptap
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return <div className="h-40 border border-slate-200 rounded-lg bg-slate-50 animate-pulse"></div>;
  }

  return (
    <div className={`border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm ${readOnly ? 'opacity-80 bg-slate-50' : ''}`}>
      {/* Toolbar */}
      {!readOnly && (
      <div className="bg-slate-50 border-b border-slate-200 p-2 flex items-center gap-1 flex-wrap">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-slate-200 ${editor.isActive('bold') ? 'bg-slate-200 text-slate-900' : 'text-slate-600'}`}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-slate-200 ${editor.isActive('italic') ? 'bg-slate-200 text-slate-900' : 'text-slate-600'}`}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        
        <div className="w-px h-5 bg-slate-300 mx-1"></div>
        
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded hover:bg-slate-200 ${editor.isActive('bulletList') ? 'bg-slate-200 text-slate-900' : 'text-slate-600'}`}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded hover:bg-slate-200 ${editor.isActive('orderedList') ? 'bg-slate-200 text-slate-900' : 'text-slate-600'}`}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        
        <div className="w-px h-5 bg-slate-300 mx-1"></div>
        
        <button
          type="button"
          onClick={() => {
            const previousUrl = editor.getAttributes('link').href;
            const url = window.prompt('URL:', previousUrl);
            if (url === null) return;
            if (url === '') {
              editor.chain().focus().extendMarkRange('link').unsetLink().run();
              return;
            }
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
          }}
          className={`p-2 rounded hover:bg-slate-200 ${editor.isActive('link') ? 'bg-slate-200 text-slate-900' : 'text-slate-600'}`}
          title="Add Link"
        >
          <LinkIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          className="p-2 rounded hover:bg-slate-200 text-slate-600"
          title="Clear Format"
        >
          <Type className="w-4 h-4" />
        </button>
      </div>
      )}

      {/* Editor Content Area */}
      <div 
        className={`p-4 prose prose-sm max-w-none text-slate-700 ${!readOnly ? 'cursor-text' : 'cursor-not-allowed'} focus-within:outline-none`} 
        style={{ minHeight }}
        onClick={() => { if(!readOnly) editor.commands.focus() }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
