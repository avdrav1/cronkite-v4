import { useState } from "react";
import { Users, UserPlus, Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FriendRequestList } from "./FriendRequestList";
import { FriendsList } from "./FriendsList";
import { UserSearch } from "./UserSearch";
import { UserDiscovery } from "./UserDiscovery";

/**
 * Main friend management component that combines all friend-related functionality
 * This component serves as the main entry point for the friend management system
 */
export function FriendManagement() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Friends</h2>
        <p className="text-muted-foreground">
          Connect with friends and manage your social network
        </p>
      </div>

      <Tabs defaultValue="friends" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="friends" className="gap-2">
            <Users className="h-4 w-4" />
            Friends
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2">
            <UserPlus className="h-4 w-4" />
            Requests
          </TabsTrigger>
          <TabsTrigger value="search" className="gap-2">
            <Search className="h-4 w-4" />
            Find Friends
          </TabsTrigger>
          <TabsTrigger value="discover" className="gap-2">
            <Users className="h-4 w-4" />
            Discover
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="mt-6">
          <FriendsList />
        </TabsContent>

        <TabsContent value="requests" className="mt-6">
          <FriendRequestList />
        </TabsContent>

        <TabsContent value="search" className="mt-6">
          <UserSearch />
        </TabsContent>

        <TabsContent value="discover" className="mt-6">
          <UserDiscovery />
        </TabsContent>
      </Tabs>
    </div>
  );
}