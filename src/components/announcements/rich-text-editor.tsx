"use client";

import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Document } from "@tiptap/extension-document";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Text } from "@tiptap/extension-text";
import { Bold } from "@tiptap/extension-bold";
import { Italic } from "@tiptap/extension-italic";
import { BulletList } from "@tiptap/extension-bullet-list";
import { OrderedList } from "@tiptap/extension-ordered-list";
import { ListItem } from "@tiptap/extension-list-item";
import { Link } from "@tiptap/extension-link";
import { History } from "@tiptap/extension-history";
import { Bold as BoldIcon, Italic as ItalicIcon, Link as LinkIcon, List, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";

// Extensoes restritas de proposito ao escopo do INC-004 (negrito, italico,
// listas, links) — "nada alem no MVP". Import individual (nao
// @tiptap/starter-kit) pra nao trazer extensoes que nunca usamos.
const EXTENSIONS = [
  Document,
  Paragraph,
  Text,
  Bold,
  Italic,
  BulletList,
  OrderedList,
  ListItem,
  History,
  Link.configure({ openOnClick: false, autolink: false }),
];

export function RichTextEditor({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const [html, setHtml] = useState(defaultValue ?? "");
  const editor = useEditor({
    extensions: EXTENSIONS,
    content: defaultValue ?? "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => setHtml(editor.getHTML()),
  });

  if (!editor) return null;

  const toggleLink = () => {
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt("URL do link:");
    if (url) editor.chain().focus().setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1 rounded-lg border border-border bg-muted p-1">
        <Button
          type="button"
          size="icon-sm"
          variant={editor.isActive("bold") ? "secondary" : "ghost"}
          aria-label="Negrito"
          aria-pressed={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <BoldIcon />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant={editor.isActive("italic") ? "secondary" : "ghost"}
          aria-label="Itálico"
          aria-pressed={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <ItalicIcon />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant={editor.isActive("bulletList") ? "secondary" : "ghost"}
          aria-label="Lista com marcadores"
          aria-pressed={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant={editor.isActive("orderedList") ? "secondary" : "ghost"}
          aria-label="Lista numerada"
          aria-pressed={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant={editor.isActive("link") ? "secondary" : "ghost"}
          aria-label="Link"
          aria-pressed={editor.isActive("link")}
          onClick={toggleLink}
        >
          <LinkIcon />
        </Button>
      </div>
      <EditorContent
        editor={editor}
        className="min-h-32 rounded-lg border border-border bg-background px-3 py-2 text-sm [&_.ProseMirror]:min-h-32 [&_.ProseMirror]:outline-none [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
      />
      <input type="hidden" name={name} value={html} />
    </div>
  );
}
