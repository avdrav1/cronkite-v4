import { useState } from "react";
import { 
  UserPlus, 
  Upload, 
  Search, 
  Mail, 
  Phone, 
  Users, 
  Contact, 
  AlertCircle, 
  CheckCircle,
  Loader2,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { UserDiscovery } from "./UserDiscovery";

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  isOnPlatform: boolean;
  userId?: string;
  avatarUrl?: string;
  canSendRequest?: boolean;
  alreadyFriend?: boolean;
}

interface ContactUploadResult {
  success: boolean;
  contacts: Contact[];
  totalProcessed: number;
  foundOnPlatform: number;
  message?: string;
}

export function AddFriendFlow() {
  const [activeTab, setActiveTab] = useState("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<ContactUploadResult | null>(null);
  const [sendingRequests, setSendingRequests] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Search for users by email or name
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await apiRequest('GET', `/api/users/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setSearchResults(data.users || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Search failed",
        description: error instanceof Error ? error.message : "Failed to search users",
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Handle contact file upload
  const handleContactUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['.csv', '.vcf', '.txt'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!validTypes.includes(fileExtension)) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload a CSV, VCF, or TXT file containing contacts",
      });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('contacts', file);

    try {
      // Use fetch directly for file upload since apiRequest doesn't handle FormData
      const response = await fetch('/api/friends/upload-contacts', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }

      const result: ContactUploadResult = await response.json();
      
      setUploadResult(result);
      setContacts(result.contacts);
      
      toast({
        title: "Contacts uploaded",
        description: `Found ${result.foundOnPlatform} friends on Cronkite from ${result.totalProcessed} contacts`,
      });
      
      setActiveTab("contacts");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload contacts",
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  // Send friend request
  const handleSendFriendRequest = async (userId: string, displayName: string) => {
    setSendingRequests(prev => new Set(prev).add(userId));
    try {
      await apiRequest('POST', '/api/friends/request', { toUserId: userId });
      toast({
        title: "Friend request sent",
        description: `Friend request sent to ${displayName}`,
      });
      
      // Update the contact/search result to reflect the sent request
      setContacts(prev => prev.map(contact => 
        contact.userId === userId 
          ? { ...contact, canSendRequest: false }
          : contact
      ));
      setSearchResults(prev => prev.map(result => 
        result.userId === userId 
          ? { ...result, canSendRequest: false }
          : result
      ));
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to send friend request",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setSendingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  // Send multiple friend requests
  const handleSendMultipleRequests = async () => {
    const contactsToInvite = contacts.filter(c => 
      selectedContacts.has(c.id) && c.isOnPlatform && c.canSendRequest && c.userId
    );
    
    if (contactsToInvite.length === 0) return;

    for (const contact of contactsToInvite) {
      if (contact.userId) {
        await handleSendFriendRequest(contact.userId, contact.name);
      }
    }
    
    setSelectedContacts(new Set());
  };

  // Toggle contact selection
  const toggleContactSelection = (contactId: string) => {
    setSelectedContacts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  const selectedCount = selectedContacts.size;
  const selectableContacts = contacts.filter(c => c.isOnPlatform && c.canSendRequest);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Add Friends</h2>
        <p className="text-muted-foreground">
          Connect with friends to share and discuss articles together
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Search
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-2">
            <Contact className="h-4 w-4" />
            Contacts
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Suggestions
          </TabsTrigger>
          <TabsTrigger value="invite" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Invite
          </TabsTrigger>
        </TabsList>

        {/* Search Tab */}
        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search for Friends
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-3">
                  {searchResults.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatarUrl} alt={user.name} />
                          <AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          {user.email && (
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          )}
                        </div>
                      </div>
                      
                      {user.alreadyFriend ? (
                        <Badge variant="secondary">Already Friends</Badge>
                      ) : user.canSendRequest && user.userId ? (
                        <Button
                          size="sm"
                          onClick={() => handleSendFriendRequest(user.userId!, user.name)}
                          disabled={sendingRequests.has(user.userId)}
                        >
                          {sendingRequests.has(user.userId) ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <UserPlus className="h-4 w-4 mr-2" />
                          )}
                          Add Friend
                        </Button>
                      ) : (
                        <Badge variant="outline">Request Sent</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Contact className="h-5 w-5" />
                Import Contacts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Upload your contact list</p>
                  <p className="text-xs text-muted-foreground">
                    Supported formats: CSV, VCF (vCard), or TXT files
                  </p>
                </div>
                <div className="mt-4">
                  <Label htmlFor="contact-upload" className="cursor-pointer">
                    <Button variant="outline" disabled={isUploading} asChild>
                      <span>
                        {isUploading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Choose File
                          </>
                        )}
                      </span>
                    </Button>
                  </Label>
                  <Input
                    id="contact-upload"
                    type="file"
                    accept=".csv,.vcf,.txt"
                    onChange={handleContactUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {uploadResult && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Processed {uploadResult.totalProcessed} contacts, found {uploadResult.foundOnPlatform} friends on Cronkite
                  </AlertDescription>
                </Alert>
              )}

              {contacts.length > 0 && (
                <div className="space-y-4">
                  {selectableContacts.length > 0 && (
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm">
                        {selectedCount} of {selectableContacts.length} friends selected
                      </p>
                      <Button
                        size="sm"
                        onClick={handleSendMultipleRequests}
                        disabled={selectedCount === 0}
                      >
                        Send {selectedCount} Request{selectedCount !== 1 ? 's' : ''}
                      </Button>
                    </div>
                  )}

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {contacts.map((contact) => (
                      <div key={contact.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {contact.isOnPlatform && contact.canSendRequest && (
                            <Checkbox
                              checked={selectedContacts.has(contact.id)}
                              onCheckedChange={() => toggleContactSelection(contact.id)}
                            />
                          )}
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={contact.avatarUrl} alt={contact.name} />
                            <AvatarFallback className="text-xs">
                              {contact.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{contact.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {contact.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {contact.email}
                                </span>
                              )}
                              {contact.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {contact.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {contact.isOnPlatform ? (
                            contact.alreadyFriend ? (
                              <Badge variant="secondary">Friends</Badge>
                            ) : contact.canSendRequest && contact.userId ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSendFriendRequest(contact.userId!, contact.name)}
                                disabled={sendingRequests.has(contact.userId)}
                              >
                                {sendingRequests.has(contact.userId) ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <UserPlus className="h-3 w-3" />
                                )}
                              </Button>
                            ) : (
                              <Badge variant="outline">Sent</Badge>
                            )
                          ) : (
                            <Badge variant="secondary">Not on Cronkite</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Suggestions Tab */}
        <TabsContent value="suggestions">
          <UserDiscovery />
        </TabsContent>

        {/* Invite Tab */}
        <TabsContent value="invite" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Invite Friends to Cronkite
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Invite friends who aren't on Cronkite yet to join and connect with you
                </AlertDescription>
              </Alert>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="invite-emails">Email Addresses</Label>
                  <Input
                    id="invite-emails"
                    placeholder="Enter email addresses separated by commas"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Example: friend1@email.com, friend2@email.com
                  </p>
                </div>
                
                <Button className="w-full">
                  <Mail className="h-4 w-4 mr-2" />
                  Send Invitations
                </Button>
              </div>

              <Separator />

              <div className="text-center space-y-2">
                <p className="text-sm font-medium">Share Cronkite</p>
                <p className="text-xs text-muted-foreground">
                  Copy this link to share with friends
                </p>
                <div className="flex gap-2">
                  <Input
                    value={`${window.location.origin}/invite?ref=your-username`}
                    readOnly
                    className="text-center"
                  />
                  <Button variant="outline" size="icon">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}