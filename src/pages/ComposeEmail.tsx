import { useEffect, useState, useRef } from 'react';
import { Send, Users, Mic, MicOff, Clock, Calendar, Loader2, Square, Lock, ImageIcon, X } from 'lucide-react';
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
import { useNavigate } from 'react-router-dom';
import type { Tables } from '@/integrations/supabase/types';

type MailGroup = Tables<'mail_groups'>;
type GroupMember = Tables<'group_members'>;

export default function ComposeEmail() {
  const { user, tier } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const limits = TIER_LIMITS[tier];

  const [groups, setGroups] = useState<MailGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  // Image URL
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');

  // Voice to text
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);

  // Scheduling
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

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

  // ─── Voice Recording (available to all tiers) ─────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

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
          setVoiceTranscript(transcript);
        };
        recognition.start();
        recognitionRef.current = recognition;
      }
    } catch {
      toast({ title: 'Microphone access denied', description: 'Please allow microphone access.', variant: 'destructive' });
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

  function insertTranscriptToBody() {
    if (!voiceTranscript.trim()) return;
    setBody(prev => prev ? `${prev}\n\n${voiceTranscript}` : voiceTranscript);
    toast({ title: 'Transcript added to message!' });
  }

  // ─── Image URL ────────────────────────────────────────────────
  function addImageUrl() {
    if (!imageUrl.trim()) return;
    setImagePreview(imageUrl.trim());
    setBody(prev => prev ? `${prev}\n\n[Image: ${imageUrl.trim()}]` : `[Image: ${imageUrl.trim()}]`);
    setImageUrl('');
    toast({ title: 'Image URL added to message!' });
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

      const { error } = await supabase.functions.invoke('send-group-email', {
        body: {
          recipients: selectedRecipients,
          subject: subject.trim(),
          body: body.trim(),
          groupId: selectedGroupId,
          scheduledAt,
          voiceNoteTranscript: voiceTranscript.trim() || undefined,
        },
      });

      if (error) throw error;

      const statusMsg = scheduledAt
        ? `Scheduled for ${new Date(scheduledAt).toLocaleString()}`
        : `Sent to ${selectedMembers.size} recipient(s)`;

      toast({ title: scheduledAt ? 'Email scheduled!' : 'Email sent!', description: statusMsg });

      setSubject('');
      setBody('');
      clearRecording();
      setImagePreview('');
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
                <Label>Message</Label>
                <Textarea
                  placeholder="Write your message..."
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  className="min-h-[200px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Voice to Text Card - Available to ALL tiers */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Mic className="w-4 h-4" /> Voice to Text
              </CardTitle>
            </CardHeader>
            <CardContent>
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
                      <Button variant="outline" size="sm" onClick={clearRecording}>Clear</Button>
                      {voiceTranscript && (
                        <Button variant="outline" size="sm" onClick={insertTranscriptToBody}>
                          Insert into message
                        </Button>
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
            </CardContent>
          </Card>

          {/* Image URL Card */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> Add Image by URL
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                />
                <Button variant="outline" onClick={addImageUrl} disabled={!imageUrl.trim()}>
                  Add
                </Button>
              </div>
              {imagePreview && (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-40 rounded-lg border border-border"
                    onError={() => setImagePreview('')}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 bg-background/80"
                    onClick={() => setImagePreview('')}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Schedule Card - Basic+ */}
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Schedule Sending
                </CardTitle>
                {!limits.scheduledSending && (
                  <Badge variant="secondary" className="text-xs">Basic+</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!limits.scheduledSending ? (
                <div className="flex flex-col items-center py-4">
                  <Lock className="w-6 h-6 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground text-center mb-3">
                    Upgrade to Basic for ${TIER_LIMITS.basic.price}/month to unlock scheduled sending
                  </p>
                  <Button variant="gradient" size="sm" onClick={() => navigate('/dashboard/billing')}>
                    Upgrade to Basic
                  </Button>
                </div>
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
