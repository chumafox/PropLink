import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import Navbar from "@/components/Navbar";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Paperclip, FileText, MessageSquare, Eye, EyeOff, Users, Home, Pin, StickyNote, X, ExternalLink, ListTodo, GripVertical, Trash2, Plus, FileSpreadsheet, FileIcon, FileImage, FileAudio, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateGroupDialog } from "@/components/CreateGroupDialog";
import { timeAgo } from "@/lib/format";
import { TranslatedMessageText } from "@/components/TranslatedMessageText";
import { uploadFileWithClient, attachmentKind } from "@/lib/upload";
import { cn, safeUrl } from "@/lib/utils";
import { toast } from "sonner";
import type { Attachment } from "@contracts/types";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { FloatingBatchData } from "../components/FloatingBatchData";

const FloatingNotes = ({
  isOpen,
  onClose,
  initialNotes,
  conversationId,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialNotes: string;
  conversationId: number;
}) => {
  const [notes, setNotes] = useState(initialNotes || "");
  const [pos, setPos] = useState({ x: window.innerWidth > 800 ? window.innerWidth - 400 : 20, y: 100 });
  const [size, setSize] = useState({ w: 300, h: 400 });
  
  const dragging = useRef(false);
  const resizing = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const sizeStart = useRef({ w: 0, h: 0 });

  const utils = trpc.useUtils();
  const saveNotes = trpc.messages.setNotes.useMutation({
    onSuccess: () => utils.messages.conversations.invalidate(),
  });

  useEffect(() => {
    setNotes(initialNotes || "");
  }, [initialNotes, conversationId]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging.current) {
        setPos({
          x: e.clientX - dragStart.current.x,
          y: e.clientY - dragStart.current.y,
        });
      }
      if (resizing.current) {
        setSize({
          w: Math.max(200, sizeStart.current.w + (e.clientX - dragStart.current.x)),
          h: Math.max(200, sizeStart.current.h + (e.clientY - dragStart.current.y)),
        });
      }
    };
    const onUp = () => {
      dragging.current = false;
      resizing.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (notes !== (initialNotes || "")) {
        saveNotes.mutate({ conversationId, notes });
      }
    }, 500);
    return () => clearTimeout(t);
  }, [notes, conversationId, initialNotes]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        zIndex: 1000,
      }}
      className="flex flex-col bg-background border rounded-lg shadow-lg overflow-hidden"
    >
      <div
        className="flex items-center justify-between px-3 py-2 bg-muted cursor-move select-none border-b"
        onMouseDown={(e) => {
          dragging.current = true;
          dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
        }}
      >
        <span className="text-sm font-semibold flex items-center gap-2">
          <StickyNote className="w-4 h-4" />
          Notes
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose} onMouseDown={(e) => e.stopPropagation()}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      <textarea
        className="flex-1 w-full p-3 resize-none outline-none text-sm bg-transparent"
        placeholder="Type notes or paste links here..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
        onMouseDown={(e) => {
          resizing.current = true;
          dragStart.current = { x: e.clientX, y: e.clientY };
          sizeStart.current = { w: size.w, h: size.h };
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 opacity-30 mt-[-4px] ml-[-4px]">
          <path d="M21 15l-6 6 M21 9l-12 12" />
        </svg>
      </div>
    </div>
  );
};

const FloatingListing = ({
  listingId,
  onClose,
}: {
  listingId: number | null;
  onClose: () => void;
}) => {
  const [pos, setPos] = useState({ x: window.innerWidth > 800 ? window.innerWidth / 2 - 175 : 20, y: 100 });
  const [size, setSize] = useState({ w: 350, h: 450 });
  
  const dragging = useRef(false);
  const resizing = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const sizeStart = useRef({ w: 0, h: 0 });

  const { data, isLoading } = trpc.listings.byId.useQuery(
    { id: listingId ?? 0 },
    { enabled: listingId !== null }
  );

  const listing = data?.listing;

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging.current) {
        setPos({
          x: e.clientX - dragStart.current.x,
          y: e.clientY - dragStart.current.y,
        });
      }
      if (resizing.current) {
        setSize({
          w: Math.max(250, sizeStart.current.w + (e.clientX - dragStart.current.x)),
          h: Math.max(300, sizeStart.current.h + (e.clientY - dragStart.current.y)),
        });
      }
    };
    const onUp = () => {
      dragging.current = false;
      resizing.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  if (listingId === null) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        zIndex: 1000,
      }}
      className="flex flex-col bg-background border rounded-lg shadow-lg overflow-hidden"
    >
      <div
        className="flex items-center justify-between px-3 py-2 bg-muted cursor-move select-none border-b"
        onMouseDown={(e) => {
          dragging.current = true;
          dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
        }}
      >
        <span className="text-sm font-semibold flex items-center gap-2 truncate pr-2">
          <Home className="w-4 h-4 shrink-0" />
          {listing ? listing.addressLine1 : "Property Details"}
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose} onMouseDown={(e) => e.stopPropagation()}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-4 flex flex-col relative bg-card">
        {isLoading && <p className="text-sm text-muted-foreground">Loading details...</p>}
        {listing && (
          <>
            {listing.photos && listing.photos.length > 0 ? (
              <img src={listing.photos[0]} alt={listing.addressLine1} className="w-full h-40 object-cover rounded-md mb-4 shrink-0" />
            ) : (
              <div className="w-full h-40 bg-muted rounded-md mb-4 flex items-center justify-center text-muted-foreground shrink-0">No Photo</div>
            )}
            <h3 className="font-semibold text-lg mb-1">{listing.addressLine1}</h3>
            <p className="text-xl font-bold text-primary mb-2">${(listing.price || 0).toLocaleString()}</p>
            <div className="text-sm text-muted-foreground flex gap-4 mb-4">
              <span>{listing.beds} beds</span>
              <span>{listing.baths} baths</span>
              <span>{listing.sqft} sqft</span>
            </div>
            <p className="text-sm flex-1 whitespace-pre-wrap">{listing.description}</p>
            
            <div className="mt-4 pt-4 border-t sticky bottom-0 bg-card">
              <Button variant="outline" className="w-full gap-2" asChild onMouseDown={(e) => e.stopPropagation()}>
                <a href={`/listings/${listing.id}`} target="_blank" rel="noreferrer">
                  Open full page <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            </div>
          </>
        )}
      </div>
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
        onMouseDown={(e) => {
          resizing.current = true;
          dragStart.current = { x: e.clientX, y: e.clientY };
          sizeStart.current = { w: size.w, h: size.h };
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 opacity-30 mt-[-4px] ml-[-4px]">
          <path d="M21 15l-6 6 M21 9l-12 12" />
        </svg>
      </div>
    </div>
  );
};

const getStatusStyle = (status: string) => {
  switch (status) {
    case "in_progress":
      return "text-primary bg-primary/5 border-primary/20";
    case "done":
      return "text-muted-foreground bg-muted/10 border-border/50 line-through";
    case "todo":
    default:
      return "text-foreground bg-background border-border/50";
  }
};

const SortableTaskItem = ({ task, updateTaskStatus, deleteTask, conversationId, editMode }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 100 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col gap-1 border border-transparent border-b-muted pb-3 mb-1 last:border-b-transparent transition-colors bg-card">
      <div className="flex items-start gap-2">
        {!editMode && (
          <div {...attributes} {...listeners} className="cursor-grab hover:text-foreground">
            <GripVertical className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
          </div>
        )}
        {editMode && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 shrink-0 mt-0.5 text-destructive hover:bg-destructive/10" 
            onClick={() => deleteTask.mutate({ conversationId, taskId: task.id })}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
        <span className={cn("text-sm font-medium flex-1", task.status === "done" && "line-through text-muted-foreground opacity-60")}>
          {task.title}
        </span>
      </div>
      <div className={cn("pl-6 mt-1", editMode && "pl-8")}>
        <Select
          value={task.status}
          onValueChange={(val: "todo" | "in_progress" | "done") => {
            updateTaskStatus.mutate({ conversationId, taskId: task.id, status: val });
          }}
        >
          <SelectTrigger className={cn("h-7 text-xs w-[130px]", getStatusStyle(task.status))}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[1100]">
            <SelectItem value="todo" className="text-muted-foreground">To Do</SelectItem>
            <SelectItem value="in_progress" className="text-primary font-medium">In Progress</SelectItem>
            <SelectItem value="done" className="text-muted-foreground">Done</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

const FloatingTaskManager = ({
  isOpen,
  onClose,
  conversationId,
}: {
  isOpen: boolean;
  onClose: () => void;
  conversationId: number;
}) => {
  const [pos, setPos] = useState({ x: window.innerWidth > 800 ? window.innerWidth / 2 + 200 : 20, y: 100 });
  const [size, setSize] = useState({ w: 320, h: 400 });
  
  const dragging = useRef(false);
  const resizing = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const sizeStart = useRef({ w: 0, h: 0 });

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [editMode, setEditMode] = useState(false);
  
  const utils = trpc.useUtils();
  const { data: tasks, isLoading } = trpc.messages.getTasks.useQuery(
    { conversationId },
    { enabled: isOpen, refetchInterval: 3000 }
  );

  const [localTasks, setLocalTasks] = useState(tasks || []);
  
  useEffect(() => {
    if (tasks) setLocalTasks(tasks);
  }, [tasks]);

  const createTask = trpc.messages.createTask.useMutation({
    onSuccess: () => {
      setNewTaskTitle("");
      utils.messages.getTasks.invalidate({ conversationId });
    }
  });

  const updateTaskStatus = trpc.messages.updateTaskStatus.useMutation({
    onMutate: async ({ taskId, status }) => {
      const newTasks = [...localTasks];
      const i = newTasks.findIndex(t => t.id === taskId);
      if (i > -1) newTasks[i].status = status;
      setLocalTasks(newTasks);
    },
    onSuccess: () => {
      utils.messages.getTasks.invalidate({ conversationId });
    }
  });

  const deleteTask = trpc.messages.deleteTask.useMutation({
    onMutate: async ({ taskId }) => {
      setLocalTasks(localTasks.filter(t => t.id !== taskId));
    },
    onSuccess: () => {
      utils.messages.getTasks.invalidate({ conversationId });
    }
  });

  const reorderTasks = trpc.messages.reorderTasks.useMutation({
    onSuccess: () => {
      utils.messages.getTasks.invalidate({ conversationId });
    }
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = localTasks.findIndex((t: any) => t.id === active.id);
      const newIndex = localTasks.findIndex((t: any) => t.id === over.id);
      const newTasks = arrayMove(localTasks, oldIndex, newIndex);
      setLocalTasks(newTasks);
      reorderTasks.mutate({ conversationId, taskIds: newTasks.map((t: any) => t.id) });
    }
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging.current) {
        setPos({
          x: e.clientX - dragStart.current.x,
          y: e.clientY - dragStart.current.y,
        });
      }
      if (resizing.current) {
        setSize({
          w: Math.max(250, sizeStart.current.w + (e.clientX - dragStart.current.x)),
          h: Math.max(300, sizeStart.current.h + (e.clientY - dragStart.current.y)),
        });
      }
    };
    const onUp = () => {
      dragging.current = false;
      resizing.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        zIndex: 1000,
      }}
      className="flex flex-col bg-background border rounded-lg shadow-lg overflow-hidden"
    >
      <div
        className="flex items-center justify-between px-3 py-2 bg-muted cursor-move select-none border-b"
        onMouseDown={(e) => {
          dragging.current = true;
          dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
        }}
      >
        <span className="text-sm font-semibold flex items-center gap-2 truncate pr-2">
          <ListTodo className="w-4 h-4 shrink-0" />
          Task Manager
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className={cn("h-6 w-6 shrink-0 transition-colors", editMode ? "bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive" : "text-muted-foreground")} onClick={() => setEditMode(!editMode)} onMouseDown={(e) => e.stopPropagation()} title="Edit / Delete Mode">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose} onMouseDown={(e) => e.stopPropagation()}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3 flex flex-col gap-2 relative bg-card" onMouseDown={(e) => e.stopPropagation()}>
        {isLoading && <p className="text-sm text-muted-foreground">Loading tasks...</p>}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={localTasks.map((t: any) => t.id)} strategy={verticalListSortingStrategy}>
            {localTasks?.map((task: any) => (
              <SortableTaskItem key={task.id} task={task} editMode={editMode} updateTaskStatus={updateTaskStatus} deleteTask={deleteTask} conversationId={conversationId} />
            ))}
          </SortableContext>
        </DndContext>
        {localTasks?.length === 0 && <p className="text-sm text-muted-foreground">No tasks yet.</p>}
      </div>
      <div className="p-2 border-t flex gap-2 bg-muted/30 shrink-0" onMouseDown={(e) => e.stopPropagation()}>
        <Input 
          value={newTaskTitle} 
          onChange={e => setNewTaskTitle(e.target.value)} 
          placeholder="New task..." 
          className="h-8 text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newTaskTitle.trim()) {
              createTask.mutate({ conversationId, title: newTaskTitle.trim() });
            }
          }}
        />
        <Button 
          size="sm" 
          className="h-8 shrink-0" 
          disabled={!newTaskTitle.trim() || createTask.isPending}
          onClick={() => createTask.mutate({ conversationId, title: newTaskTitle.trim() })}
        >
          Add
        </Button>
      </div>
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
        onMouseDown={(e) => {
          resizing.current = true;
          dragStart.current = { x: e.clientX, y: e.clientY };
          sizeStart.current = { w: size.w, h: size.h };
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 opacity-30 mt-[-4px] ml-[-4px]">
          <path d="M21 15l-6 6 M21 9l-12 12" />
        </svg>
      </div>
    </div>
  );
};
const FloatingFilePreview = ({ file, onClose, onDelete }: { file: { url: string; name: string; kind: "image" | "document" | "audio" } | null; onClose: () => void; onDelete?: () => void; }) => {
  const pos = useRef({ x: window.innerWidth - 350, y: 100 });
  const size = useRef({ w: 320, h: 400 });
  const dragging = useRef(false);
  const resizing = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const sizeStart = useRef({ w: 0, h: 0 });
  const [, forceRender] = useState(0);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (dragging.current) {
        pos.current = { x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y };
        forceRender(r => r + 1);
      }
      if (resizing.current) {
        size.current = {
          w: Math.max(200, sizeStart.current.w + (e.clientX - dragStart.current.x)),
          h: Math.max(200, sizeStart.current.h + (e.clientY - dragStart.current.y))
        };
        forceRender(r => r + 1);
      }
    };
    const up = () => { dragging.current = false; resizing.current = false; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);

  if (!file) return null;

  const isAudio = (file?.name || "").match(/\.(mp3|wav|ogg|m4a|aac)$/i);

  return (
    <div
      className="fixed z-[1000] flex flex-col bg-background border rounded-lg shadow-lg overflow-hidden"
      style={{ left: pos.current.x, top: pos.current.y, width: size.current.w, height: size.current.h }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 bg-muted cursor-move select-none border-b"
        onMouseDown={(e) => {
          dragging.current = true;
          dragStart.current = { x: e.clientX - pos.current.x, y: e.clientY - pos.current.y };
        }}
      >
        <span className="text-sm font-semibold flex items-center gap-2 truncate pr-2">
          {isAudio ? <FileAudio className="w-4 h-4 shrink-0" /> : <FileIcon className="w-4 h-4 shrink-0" />}
          {file.name}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {onDelete && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-100/50" onClick={onDelete} onMouseDown={(e) => e.stopPropagation()} title="Delete file">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose} onMouseDown={(e) => e.stopPropagation()}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-card relative">
        {isAudio ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-card">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-6 shrink-0">
               <FileAudio className="w-8 h-8 text-primary" />
            </div>
            <p className="font-semibold mb-8 truncate w-full text-foreground/90">{file.name}</p>
            <audio controls src={safeUrl(file.url)} className="w-full max-w-[280px]" onMouseDown={(e) => e.stopPropagation()} />
          </div>
        ) : file.kind === "image" ? (
          <img src={safeUrl(file.url)} alt={file.name} className="w-full h-full object-contain" />
        ) : (file?.name || "").toLowerCase().endsWith(".pdf") ? (
          <iframe src={safeUrl(file.url)} className="w-full h-full border-0" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <FileIcon className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="font-semibold mb-4 truncate w-full">{file.name}</p>
            <Button asChild onMouseDown={(e) => e.stopPropagation()}>
              <a href={safeUrl(file.url)} target="_blank" download>Open File</a>
            </Button>
          </div>
        )}
      </div>
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
        onMouseDown={(e) => {
          resizing.current = true;
          dragStart.current = { x: e.clientX, y: e.clientY };
          sizeStart.current = { w: size.current.w, h: size.current.h };
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 opacity-30 mt-[-4px] ml-[-4px]">
          <path d="M21 15l-6 6 M21 9l-12 12" />
        </svg>
      </div>
    </div>
  );
};

function SortableConversationItem({ 
  conv, 
  activeId, 
  onClick,
  onTogglePin
}: { 
  conv: any; 
  activeId: number; 
  onClick: () => void;
  onTogglePin: (id: number, isPinned: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: conv.conversation.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
    position: 'relative' as const,
  };

  const { conversation, participant, otherUser, unreadCount, listingTitle } = conv;
  const isGroup = conversation.isGroup === 1;
  const title = isGroup ? (conversation.subject || "Group Chat") : (otherUser?.name ?? "Conversation");
  const initials = isGroup ? title.slice(0, 2).toUpperCase() : (otherUser?.name?.slice(0, 2).toUpperCase() ?? "?");
  const isPinned = !!participant?.isPinned;

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div 
        {...attributes} 
        {...listeners} 
        className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-muted/50 to-transparent"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      <button
        onClick={onClick}
        className={cn(
          "flex w-full items-start gap-3 border-b p-4 text-left transition-colors hover:bg-muted/50 pl-8",
          activeId === conversation.id && "bg-primary/5",
        )}
      >
        <Avatar className="h-10 w-10 shrink-0">
          {!isGroup && <AvatarImage src={otherUser?.avatar ?? undefined} />}
          <AvatarFallback className={isGroup ? "bg-primary/10 text-primary" : ""}>
            {isGroup ? <Users className="h-4 w-4" /> : initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold flex items-center gap-1">
              {isPinned && <Pin className="w-3 h-3 text-primary fill-primary rotate-45 shrink-0" />}
              {title}
            </p>
            <span className="flex shrink-0 items-center gap-1">
              {conversation.channel !== "internal" && (
                <Badge variant="secondary" className="text-[9px] uppercase">
                  {conversation.channel}
                </Badge>
              )}
              {unreadCount > 0 && (
                <Badge className="border-0 bg-primary text-white">
                  {unreadCount}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin(conversation.id, !isPinned);
                }}
              >
                <Pin className={cn("w-3 h-3", isPinned ? "text-primary fill-primary" : "text-muted-foreground")} />
              </Button>
            </span>
          </div>
          {listingTitle && (
            <p className="truncate text-xs font-medium text-primary mb-0.5">
              {listingTitle}
            </p>
          )}
          <div className="flex justify-between items-center mt-1">
            <p className="truncate text-xs text-muted-foreground">
              {conv.lastMessage?.body || "Started conversation"}
            </p>
            <p className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
              {timeAgo(conversation.lastMessageAt)}
            </p>
          </div>
        </div>
      </button>
    </div>
  );
}

export default function Messages() {
  const { user, isLoading } = useAuth({ redirectOnUnauthenticated: true });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const convId = id ? Number(id) : null;
  const utils = trpc.useUtils();
  const [notesOpen, setNotesOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [batchDataOpen, setBatchDataOpen] = useState(false);
  const [previewListingId, setPreviewListingId] = useState<number | null>(null);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; kind: "image" | "document" | "audio" } | null>(null);
  const [isUploadingPin, setIsUploadingPin] = useState(false);
  const fileInputPinRef = useRef<HTMLInputElement>(null);

  const { data: convs } = trpc.messages.conversations.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 5000,
  });

  const setPinnedFiles = trpc.messages.setPinnedFiles.useMutation({
    onSuccess: () => utils.messages.conversations.invalidate(),
    onError: (e) => toast.error("Failed to pin file: " + e.message)
  });
  const { data: msgs } = trpc.messages.messages.useQuery(
    { conversationId: convId! },
    { enabled: !!user && !!convId, refetchInterval: 3000 },
  );
  const { data: aiSettings } = trpc.ai.getSettings.useQuery(undefined, {
    enabled: !!user,
  });
  const { data: uploadInfo } = trpc.uploads.available.useQuery(undefined, {
    enabled: !!user,
  });

  const send = trpc.messages.send.useMutation({
    onSuccess: () => {
      setBody("");
      utils.messages.messages.invalidate({ conversationId: convId! });
      utils.messages.conversations.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const [localConvs, setLocalConvs] = useState<any[]>([]);

  useEffect(() => {
    if (convs) setLocalConvs(convs);
  }, [convs]);

  const togglePin = trpc.messages.togglePinConversation.useMutation({
    onMutate: async ({ conversationId, isPinned }) => {
      const newConvs = [...localConvs];
      const i = newConvs.findIndex(c => c.conversation.id === conversationId);
      if (i > -1) {
        newConvs[i] = {
          ...newConvs[i],
          participant: {
            ...newConvs[i].participant,
            isPinned: isPinned ? 1 : 0
          }
        };
        // Re-sort locally immediately for optimistic UI
        newConvs.sort((a, b) => {
          if (a.participant.isPinned !== b.participant.isPinned) {
            return (b.participant.isPinned || 0) - (a.participant.isPinned || 0);
          }
          if (a.participant.isPinned) {
            const orderA = a.participant.sortOrder || 0;
            const orderB = b.participant.sortOrder || 0;
            if (orderA !== orderB) return orderA - orderB;
          }
          const aTime = a.conversation.lastMessageAt ? new Date(a.conversation.lastMessageAt).getTime() : 0;
          const bTime = b.conversation.lastMessageAt ? new Date(b.conversation.lastMessageAt).getTime() : 0;
          return bTime - aTime;
        });
        setLocalConvs(newConvs);
      }
    },
    onSuccess: () => {
      utils.messages.conversations.invalidate();
    }
  });

  const reorderConvs = trpc.messages.reorderConversations.useMutation({
    onSuccess: () => {
      utils.messages.conversations.invalidate();
    }
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = localConvs.findIndex(c => c.conversation.id === active.id);
      const newIndex = localConvs.findIndex(c => c.conversation.id === over.id);
      const newConvs = arrayMove(localConvs, oldIndex, newIndex);
      setLocalConvs(newConvs);
      reorderConvs.mutate({ conversationIds: newConvs.map(c => c.conversation.id) });
    }
  };

  const markRead = trpc.messages.markRead.useMutation({
    onSuccess: () => {
      utils.messages.unreadCount.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });
  const hideMessage = trpc.messages.hideMessage.useMutation({
    onSuccess: () => utils.messages.messages.invalidate({ conversationId: convId! }),
  });
  const unhideMessage = trpc.messages.unhideMessage.useMutation({
    onSuccess: () => utils.messages.messages.invalidate({ conversationId: convId! }),
  });
  const setListing = trpc.messages.setListing.useMutation({
    onSuccess: () => utils.messages.conversations.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const [body, setBody] = useState("");
  const [pendingAtt, setPendingAtt] = useState<Attachment[]>([]);
  const [attOpen, setAttOpen] = useState(false);
  const [attUrl, setAttUrl] = useState("");
  const [attName, setAttName] = useState("");
  const [attKind, setAttKind] = useState<"image" | "document">("document");
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (convId) markRead.mutate({ conversationId: convId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId, msgs?.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs?.length]);

  if (isLoading) return null;

  const submit = () => {
    if (!convId || (!body.trim() && pendingAtt.length === 0)) return;
    send.mutate({ conversationId: convId, body, attachments: pendingAtt });
    setPendingAtt([]);
  };

  const handlePinFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConv) return;
    
    if (!uploadInfo?.configured && file.size > 2 * 1024 * 1024) {
      toast.error("Local file upload (without S3) is limited to 2MB to prevent database overload.");
      e.target.value = "";
      return;
    }
    
    // Best practice: Limit file size to 25MB to avoid overwhelming storage or timeouts
    if (file.size > 25 * 1024 * 1024) {
      toast.error("File is too large (max 25 MB)");
      e.target.value = "";
      return;
    }

    setIsUploadingPin(true);
    try {
      const kind = file.type.startsWith("image/") ? "image" : "document";
      const existing = activeConv.conversation.pinnedFiles || [];

      if (!uploadInfo?.configured) {
        // Fallback for local development when S3/R2 is not configured
        const reader = new FileReader();
        reader.onload = () => {
          const base64Url = reader.result as string;
          setPinnedFiles.mutate({
            conversationId: activeConv.conversation.id,
            files: [...existing, { url: base64Url, name: file.name, kind }]
          });
          setIsUploadingPin(false);
        };
        reader.onerror = () => {
          toast.error("Failed to read file locally");
          setIsUploadingPin(false);
        };
        reader.readAsDataURL(file);
        e.target.value = "";
        return;
      }

      const { storedUrl } = await uploadFileWithClient(utils.client, file, "private");
      setPinnedFiles.mutate({
        conversationId: activeConv.conversation.id,
        files: [...existing, { url: storedUrl, name: file.name, kind }]
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to pin file");
      setIsUploadingPin(false);
    } finally {
      if (uploadInfo?.configured) {
        setIsUploadingPin(false);
      }
      e.target.value = "";
    }
  };

  const activeConv = convs?.find((c) => c.conversation.id === convId);

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <Navbar />
      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-4 px-4 py-6 sm:px-6">
        {/* Conversation list */}
        <aside
          className={cn(
            "w-full shrink-0 rounded-xl border bg-white shadow-sm sm:w-80",
            convId && "hidden sm:block",
          )}
        >
          <div className="border-b p-4 flex items-center justify-between">
            <h1 className="flex items-center gap-2 text-lg font-bold">
              <MessageSquare className="h-5 w-5 text-primary" /> Messages
            </h1>
            <CreateGroupDialog />
          </div>
          <div className="max-h-[calc(100vh-12rem)] overflow-y-auto">
            {localConvs.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">
                No conversations yet. Open any listing and message the agent.
              </p>
            )}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={localConvs.map(c => c.conversation.id)} strategy={verticalListSortingStrategy}>
                {localConvs.map((conv) => (
                  <SortableConversationItem
                    key={conv.conversation.id}
                    conv={conv}
                    activeId={convId || 0}
                    onClick={() => navigate(`/messages/${conv.conversation.id}`)}
                    onTogglePin={(id, isPinned) => togglePin.mutate({ conversationId: id, isPinned: isPinned ? 1 : 0 })}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </aside>

        {/* Thread */}
        <section
          className={cn(
            "flex flex-1 flex-col rounded-xl border bg-white shadow-sm",
            !convId && "hidden sm:flex",
          )}
        >
          {!convId ? (
            <div className="flex flex-1 items-center justify-center p-10 text-muted-foreground">
              Select a conversation
            </div>
          ) : !activeConv ? (
            <div className="flex flex-1 items-center justify-center p-10 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b p-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="sm:hidden"
                  onClick={() => navigate("/messages")}
                >
                  ←
                </Button>
                {(() => {
                  const isGroup = activeConv?.conversation?.isGroup === 1;
                  const title = isGroup ? (activeConv.conversation.subject || "Group Chat") : (activeConv?.otherUser?.name ?? "Conversation");
                  const initials = isGroup ? title.slice(0, 2).toUpperCase() : (activeConv?.otherUser?.name?.slice(0, 2).toUpperCase() ?? "?");
                  const relatedListings = activeConv?.relatedListings || [];
                  
                  return (
                    <>
                      <Avatar className="h-9 w-9 shrink-0">
                        {!isGroup && <AvatarImage src={activeConv?.otherUser?.avatar ?? undefined} />}
                        <AvatarFallback className={isGroup ? "bg-primary/10 text-primary" : ""}>
                          {isGroup ? <Users className="h-4 w-4" /> : initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {title}
                        </p>
                        {activeConv?.listingTitle && (
                          <p className="text-xs text-primary truncate">
                            {activeConv.listingTitle}
                          </p>
                        )}
                        {isGroup && activeConv?.otherUsers && (
                          <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                            {activeConv.otherUsers.map(u => u.name).join(", ")}
                          </p>
                        )}
                      </div>

                      <input type="file" ref={fileInputPinRef} className="hidden" onChange={handlePinFile} accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,image/*,audio/*" />

                      {Array.isArray(activeConv?.conversation.pinnedFiles) && activeConv.conversation.pinnedFiles.map((file, i) => {
                        const name = file?.name || "";
                        const isPdf = name.toLowerCase().endsWith(".pdf");
                        const isSpreadsheet = name.toLowerCase().endsWith(".csv") || name.toLowerCase().endsWith(".xlsx") || name.toLowerCase().endsWith(".xls");
                        const isAudio = name.match(/\.(mp3|wav|ogg|m4a|aac)$/i);
                        return (
                          <Button 
                            key={i} 
                            variant="ghost" 
                            size="icon" 
                            className="shrink-0 mr-1" 
                            title={file.name} 
                            onClick={() => setPreviewFile(file)}
                          >
                            {isPdf ? <FileText className="h-5 w-5 text-blue-500" /> : 
                             isSpreadsheet ? <FileSpreadsheet className="h-5 w-5 text-green-500" /> :
                             isAudio ? <FileAudio className="h-5 w-5 text-orange-500" /> :
                             file.kind === "image" ? <FileImage className="h-5 w-5 text-primary" /> :
                             <FileIcon className="h-5 w-5 text-primary" />}
                          </Button>
                        );
                      })}
                      
                      <Button variant="ghost" size="icon" className="shrink-0 mr-1 opacity-50 hover:opacity-100" title="Pin a file" onClick={() => fileInputPinRef.current?.click()} disabled={isUploadingPin}>
                        {isUploadingPin ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Plus className="h-4 w-4 text-muted-foreground" />}
                      </Button>

                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="shrink-0 mr-1" 
                        title="Task Manager" 
                        onClick={() => setTasksOpen(!tasksOpen)}
                      >
                        <ListTodo className="h-5 w-5 text-primary" />
                      </Button>
                      
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="shrink-0 mr-1" 
                        title="Notes" 
                        onClick={() => setNotesOpen(!notesOpen)}
                      >
                        <StickyNote className="h-5 w-5 text-primary" />
                      </Button>
                      
                      {relatedListings.length > 0 && !activeConv.conversation.listingId && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="shrink-0" title="Select a property for this chat">
                              <Home className="h-5 w-5 text-primary" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-64">
                            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Pin property to chat</div>
                            {relatedListings.map(l => (
                              <div key={l.id} className="flex items-center justify-between px-2 py-1.5 hover:bg-muted/50 rounded-sm group">
                                <button 
                                  onClick={(e) => { e.preventDefault(); setPreviewListingId(l.id); }} 
                                  className="flex-1 truncate text-sm text-left hover:underline"
                                >
                                  {l.title}
                                </button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 ml-2 opacity-0 group-hover:opacity-100"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setListing.mutate({ conversationId: activeConv.conversation.id, listingId: l.id });
                                  }}
                                  title="Pin this property"
                                >
                                  <Pin className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      
                      {activeConv.conversation.listingId && relatedListings.length > 0 && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="shrink-0" 
                          title={relatedListings[0].title ?? undefined}
                          onClick={() => setPreviewListingId(activeConv.conversation.listingId!)}
                        >
                          <Home className="h-5 w-5 text-primary" />
                        </Button>
                      )}

                      {activeConv.conversation.listingId && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="shrink-0 px-2 ml-1" 
                          title="BatchData"
                          onClick={() => setBatchDataOpen(true)}
                        >
                          <img src="/batchdata.svg" className="h-4 w-auto grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all" alt="BatchData" />
                        </Button>
                      )}
                    </>
                  );
                })()}
              </div>

              <FloatingFilePreview 
                file={previewFile} 
                onClose={() => setPreviewFile(null)} 
                onDelete={() => {
                  if (activeConv && previewFile) {
                    const existing = activeConv.conversation.pinnedFiles || [];
                    const newFiles = existing.filter(f => f.url !== previewFile.url);
                    setPinnedFiles.mutate({
                      conversationId: activeConv.conversation.id,
                      files: newFiles
                    });
                    setPreviewFile(null);
                  }
                }}
              />


              <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: "calc(100vh - 20rem)" }}>
                {msgs?.map(({ message, senderName, senderAvatar, isHidden }) => {
                  const mine = message.senderId === user?.id;

                  if (isHidden) {
                    return (
                      <div key={message.id} className="flex justify-center my-2">
                        <button
                          onClick={() => unhideMessage.mutate({ messageId: message.id })}
                          className="text-[11px] text-muted-foreground flex items-center gap-1 hover:underline bg-muted/30 px-3 py-1 rounded-full transition-colors"
                        >
                          <Eye className="h-3 w-3" /> Message hidden (Click to unhide)
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={message.id}
                      className={cn("flex gap-2 group", mine && "flex-row-reverse")}
                    >
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={senderAvatar ?? undefined} />
                        <AvatarFallback className="text-[10px]">
                          {senderName?.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-4 py-2",
                          mine
                            ? "bg-primary text-white"
                            : "bg-muted text-foreground",
                        )}
                      >
                        {message.body &&
                          (mine ? (
                            <p className="whitespace-pre-line text-sm">
                              {message.body}
                            </p>
                          ) : (
                            <TranslatedMessageText
                              message={message}
                              targetLang={aiSettings?.targetLanguage}
                              autoTranslate={aiSettings?.autoTranslate}
                            />
                          ))}
                        {message.attachments?.map((a, i) =>
                          a.kind === "image" ? (
                            <a key={i} href={a.url} target="_blank" rel="noreferrer">
                              <img
                                src={a.url}
                                alt={a.name}
                                className="mt-2 max-h-48 rounded-lg"
                              />
                            </a>
                          ) : (
                            <a
                              key={i}
                              href={safeUrl(a.url)}
                              target="_blank"
                              rel="noreferrer"
                              className={cn(
                                "mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                                mine ? "bg-white/20" : "bg-white",
                              )}
                            >
                              <FileText className="h-4 w-4 shrink-0" />
                              <span className="truncate underline">{a.name}</span>
                            </a>
                          ),
                        )}
                        <div className={cn("mt-1 flex items-center justify-end gap-2 text-[10px]", mine ? "text-white/70" : "text-muted-foreground")}>
                          <button
                            onClick={() => hideMessage.mutate({ messageId: message.id })}
                            className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 hover:text-white"
                            title="Hide message"
                          >
                            <EyeOff className="h-3 w-3" />
                            Hide
                          </button>
                          <p>{timeAgo(message.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {pendingAtt.length > 0 && (
                <div className="flex flex-wrap gap-2 border-t px-4 pt-2">
                  {pendingAtt.map((a, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      <FileText className="h-3 w-3" /> {a.name}
                      <button
                        className="ml-1 text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          setPendingAtt((p) => p.filter((_, j) => j !== i))
                        }
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 border-t p-4">
                <Dialog open={attOpen} onOpenChange={setAttOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Paperclip className="h-5 w-5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Attach a file</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      {uploadInfo?.configured && (
                        <div className="space-y-1.5">
                          <Label>Upload from your device</Label>
                          <Input
                            type="file"
                            disabled={uploading}
                            accept="image/*,application/pdf,.doc,.docx,.txt,.csv"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > uploadInfo.maxBytes) {
                                toast.error("File is too large (max 25 MB)");
                                return;
                              }
                              setUploading(true);
                              try {
                                const { storedUrl } = await uploadFileWithClient(
                                  utils.client,
                                  file,
                                  "private",
                                );
                                setPendingAtt((p) => [
                                  ...p,
                                  {
                                    url: storedUrl,
                                    name: file.name,
                                    kind: attachmentKind(file.type),
                                  },
                                ]);
                                setAttOpen(false);
                              } catch (err: any) {
                                toast.error(err?.message ?? "Upload failed");
                              } finally {
                                setUploading(false);
                                e.target.value = "";
                              }
                            }}
                          />
                          {uploading && (
                            <p className="text-xs text-muted-foreground">
                              Uploading…
                            </p>
                          )}
                          <p className="text-center text-xs text-muted-foreground">
                            — or paste a link below —
                          </p>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label>Type</Label>
                        <Select
                          value={attKind}
                          onValueChange={(v) => setAttKind(v as any)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="document">Document</SelectItem>
                            <SelectItem value="image">Photo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Name</Label>
                        <Input
                          placeholder="Purchase agreement.pdf"
                          value={attName}
                          onChange={(e) => setAttName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>File URL</Label>
                        <Input
                          placeholder="https://…"
                          value={attUrl}
                          onChange={(e) => setAttUrl(e.target.value)}
                        />
                      </div>
                      <Button
                        className="w-full"
                        disabled={!attUrl || !attName}
                        onClick={() => {
                          setPendingAtt((p) => [
                            ...p,
                            { url: attUrl, name: attName, kind: attKind },
                          ]);
                          setAttUrl("");
                          setAttName("");
                          setAttOpen(false);
                        }}
                      >
                        Attach
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Input
                  placeholder="Write a message…"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submit()}
                />
                <Button
                  size="icon"
                  disabled={send.isPending || (!body.trim() && !pendingAtt.length)}
                  onClick={submit}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </section>
      </div>

      {activeConv && (
        <FloatingNotes
          isOpen={notesOpen}
          onClose={() => setNotesOpen(false)}
          initialNotes={activeConv.participant.notes || ""}
          conversationId={activeConv.conversation.id}
        />
      )}

      {activeConv && (
        <FloatingTaskManager
          isOpen={tasksOpen}
          onClose={() => setTasksOpen(false)}
          conversationId={activeConv.conversation.id}
        />
      )}

      {activeConv?.conversation.listingId && (
        <FloatingBatchData
          isOpen={batchDataOpen}
          onClose={() => setBatchDataOpen(false)}
          listingId={activeConv.conversation.listingId}
        />
      )}

      <FloatingListing
        listingId={previewListingId}
        onClose={() => setPreviewListingId(null)}
      />
    </div>
  );
}
