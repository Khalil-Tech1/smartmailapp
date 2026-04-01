import { useEffect, useState, useRef } from 'react';
import { Send, Users, Sparkles, Mic, MicOff, Clock, Calendar, Loader2, Square, Paperclip, X, FileIcon, ImageIcon, VideoIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TIER_LIMITS } from '@/lib/tier-limits';
import type { Tables } from '@/integrations/supabase/types';

type MailGroup = Tables<'mail_groups'>;
type GroupMember = Tables<'group_members'>;

export default function ComposeEmail() {
  const { user, tier } = useAuth();
  const { toast } = useToast();
  const limits = TIER_LIMITS[tier];

  const [groups, setGroups] = useState<MailGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  // AI personalization
  const [aiLoading, setAiLoading] = useState(false);

  // Voice notes
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const liveTranscriptRef = useRef('');

  // Scheduling
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  // Attachments
  const [attachments, setAttachments] = useState<{ name: string; url: string; type: string; size: number }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) loadGroups();
  }, [user]);

  useEffect(() => {
    if (selectedGroupId) loadMembers(selectedGroupId);
  }, [selectedGroupId]);

  async function loadGroups() {
    const { data } = await supabase.from('mail_groups').select('*').order('name');
    if (data) setGroups(data);
  }

  async function loadMembers(groupId: string) {
    const { data } = await supabase.from('group_members').select('*').eq('group_id', groupId);
    if (data) {
      setMembers(data);
      setSelectedMembers(new Set(data.map(m => m.id)));
    }
  }

  function toggleMember(id: string) {
    setSelectedMembers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selectedMembers.size === members.length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(members.map(m => m.id)));
    }
  }

  // ─── Voice Recording ─────────────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      liveTranscriptRef.current = '';

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Start speech recognition if available
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          liveTranscriptRef.current = transcript;
          setVoiceTranscript(transcript);
        };
        recognition.start();
        recognitionRef.current = recognition;
      }
    } catch {
      toast({ title: 'Microphone access denied', description: 'Please allow microphone access to record voice notes.', variant: 'destructive' });
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    recognitionRef.current?.stop();
    setIsRecording(false);
  }

  function clearRecording() {
    setAudioBlob(null);
    setAudioUrl(null);
    setVoiceTranscript('');
  }

  async function cleanUpTranscript() {
    if (!voiceTranscript.trim()) return;
    setTranscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-personalize', {
        body: { action: 'transcribe', voiceText: voiceTranscript },
      });
      if (error) throw error;
      if (data?.transcription) {
        setVoiceTranscript(data.transcription);
        toast({ title: 'Transcript polished!' });
      }
    } catch (err: any) {
      toast({ title: 'Transcription error', description: err.message, variant: 'destructive' });
    } finally {
      setTranscribing(false);
    }
  }

  function insertTranscriptToBody() {
    if (!voiceTranscript.trim()) return;
    setBody(prev => prev ? `${prev}\n\n${voiceTranscript}` : voiceTranscript);
    toast({ title: 'Transcript added to message!' });
  }

  // ─── File Attachments ────────────────────────────────────────
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !user) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          toast({ title: 'File too large', description: `${file.name} exceeds 10MB limit.`, variant: 'destructive' });
          continue;
        }
        const path = `${user.id}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from('email-attachments').upload(path, file);
        if (error) {
          toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
          continue;
        }
        const { data: urlData } = supabase.storage.from('email-attachments').getPublicUrl(path);
        setAttachments(prev => [...prev, {
          name: file.name,
          url: urlData.publicUrl,
          type: file.type,
          size: file.size,
        }]);
      }
      toast({ title: 'Files attached!' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function removeAttachment(index: number) {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  }

  function getFileIcon(type: string) {
    if (type.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-primary" />;
    if (type.startsWith('video/')) return <VideoIcon className="w-4 h-4 text-primary" />;
    return <FileIcon className="w-4 h-4 text-muted-foreground" />;
  }

  // ─── AI Personalization ───────────────────────────────────────
  async function aiPersonalize() {
    if (!body.trim()) {
      toast({ title: 'Write a message first', variant: 'destructive' });
      return;
    }
    setAiLoading(true);
    try {
      const firstSelectedMember = members.find(m => selectedMembers.has(m.id));
      const { data, error } = await supabase.functions.invoke('ai-personalize', {
        body: {
          action: 'personalize',
          message: body,
          recipientName: firstSelectedMember?.name || undefined,
          recipientEmail: firstSelectedMember?.email || undefined,
        },
      });
      if (error) throw error;
      if (data?.personalizedMessage) {
        setBody(data.personalizedMessage);
        toast({ title: 'Message personalized with AI!' });
      }
    } catch (err: any) {
      toast({ title: 'AI error', description: err.message, variant: 'destructive' });
    } finally {
      setAiLoading(false);
    }
  }

  // ─── Send Email ───────────────────────────────────────────────
  async function handleSend() {
    if (!user || !selectedGroupId || !subject.trim() || !body.trim() || selectedMembers.size === 0) {
      toast({ title: 'Please fill all fields', description: 'Select a group, recipients, subject and message.', variant: 'destructive' });
      return;
    }

    if (scheduleEnabled && (!scheduleDate || !scheduleTime)) {
      toast({ title: 'Set schedule', description: 'Pick a date and time for scheduled sending.', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      const selectedRecipients = members
        .filter(m => selectedMembers.has(m.id))
        .map(m => ({ email: m.email, name: m.name }));

      const scheduledAt = scheduleEnabled
        ? new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
        : undefined;

      const { data, error } = await supabase.functions.invoke('send-group-email', {
        body: {
          recipients: selectedRecipients,
          subject: subject.trim(),
          body: body.trim(),
          groupId: selectedGroupId,
          scheduledAt,
          voiceNoteTranscript: voiceTranscript.trim() || undefined,
          attachments: attachments.length > 0 ? attachments : undefined,
        },
      });

      if (error) throw error;

      const statusMsg = scheduledAt
        ? `Scheduled for ${new Date(scheduledAt).toLocaleString()}`
        : `Sent to ${selectedMembers.size} recipient(s)`;

      toast({ title: scheduledAt ? 'Email scheduled!' : 'Email sent!', description: statusMsg });

      // Reset form
      setSubject('');
      setBody('');
      clearRecording();
      setAttachments([]);
      setScheduleEnabled(false);
      setScheduleDate('');
      setScheduleTime('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  }

  const minDate = new Date().toISOString().split('T')[0];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-display">Compose Email</h1>
        <p className="text-muted-foreground mt-1">Send emails to your groups or selected members.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Message Card */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="font-display text-lg">Message</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Send to Group</Label>
                <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a mail group" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input placeholder="Email subject..." value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Message</Label>
                  {limits.aiMessages && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={aiPersonalize}
                      disabled={aiLoading || !body.trim()}
                      className="gap-1.5 text-xs"
                    >
                      {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      AI Personalize
                    </Button>
                  )}
                </div>
                <Textarea
                  placeholder="Write your message..."
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  className="min-h-[200px]"
                />
                {!limits.aiMessages && (
                  <p className="text-xs text-muted-foreground">
                    <Sparkles className="w-3 h-3 inline mr-1" />
                    Upgrade to Basic or higher for AI-personalized messages
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Voice Notes Card */}
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <Mic className="w-4 h-4" /> Voice Note
                </CardTitle>
                {!limits.voiceNotes && (
                  <Badge variant="secondary" className="text-xs">Basic+</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!limits.voiceNotes ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Upgrade to Basic or higher to record voice notes
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    {!isRecording && !audioBlob && (
                      <Button variant="outline" onClick={startRecording} className="gap-2">
                        <Mic className="w-4 h-4 text-destructive" />
                        Start Recording
                      </Button>
                    )}
                    {isRecording && (
                      <Button variant="destructive" onClick={stopRecording} className="gap-2">
                        <Square className="w-4 h-4" />
                        Stop Recording
                      </Button>
                    )}
                    {isRecording && (
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                        <span className="text-sm text-destructive font-medium">Recording...</span>
                      </div>
                    )}
                  </div>

                  {audioUrl && (
                    <div className="space-y-3">
                      <audio src={audioUrl} controls className="w-full" />
                      <div className="flex gap-2 flex-wrap">
                        <Button variant="outline" size="sm" onClick={clearRecording}>
                          Clear
                        </Button>
                        {voiceTranscript && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={cleanUpTranscript}
                              disabled={transcribing}
                              className="gap-1.5"
                            >
                              {transcribing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                              Polish with AI
                            </Button>
                            <Button variant="outline" size="sm" onClick={insertTranscriptToBody}>
                              Insert into message
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {voiceTranscript && (
                    <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Transcript</p>
                      <p className="text-sm">{voiceTranscript}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Schedule Card */}
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Schedule Sending
                </CardTitle>
                {!limits.scheduledSending && (
                  <Badge variant="secondary" className="text-xs">Pro+</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!limits.scheduledSending ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Upgrade to Pro or higher for scheduled sending
                </p>
              ) : (
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={scheduleEnabled}
                      onCheckedChange={(checked) => setScheduleEnabled(checked === true)}
                    />
                    <span className="text-sm font-medium">Schedule for later</span>
                  </label>
                  {scheduleEnabled && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" /> Date
                        </Label>
                        <Input
                          type="date"
                          value={scheduleDate}
                          onChange={e => setScheduleDate(e.target.value)}
                          min={minDate}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" /> Time
                        </Label>
                        <Input
                          type="time"
                          value={scheduleTime}
                          onChange={e => setScheduleTime(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attachments Card */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Paperclip className="w-4 h-4" /> Attachments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="gap-2 w-full mb-3"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                {uploading ? 'Uploading...' : 'Attach Files, Images, or Videos'}
              </Button>
              <p className="text-xs text-muted-foreground mb-3">Max 10MB per file. Supports images, videos, PDFs, documents.</p>
              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        {getFileIcon(file.type)}
                        <span className="truncate">{file.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(file.size)}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeAttachment(i)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Send Button */}
          <Button onClick={handleSend} variant="gradient" className="w-full" disabled={sending}>
            {sending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : scheduleEnabled ? (
              <Clock className="w-4 h-4 mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {sending
              ? 'Processing...'
              : scheduleEnabled
                ? `Schedule for ${selectedMembers.size} recipient(s)`
                : `Send to ${selectedMembers.size} recipient(s)`}
          </Button>
        </div>

        {/* Recipients panel */}
        <div>
          <Card className="border-border/50 sticky top-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-display text-lg">Recipients</CardTitle>
              {members.length > 0 && (
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  {selectedMembers.size === members.length ? 'Deselect All' : 'Select All'}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!selectedGroupId ? (
                <p className="text-sm text-muted-foreground text-center py-8">Select a group first</p>
              ) : members.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No members in this group</p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {members.map(member => (
                    <label
                      key={member.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedMembers.has(member.id)}
                        onCheckedChange={() => toggleMember(member.id)}
                      />
                      <div>
                        <p className="text-sm font-medium">{member.name || member.email}</p>
                        {member.name && <p className="text-xs text-muted-foreground">{member.email}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
