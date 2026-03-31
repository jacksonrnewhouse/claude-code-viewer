import { useLingui } from "@lingui/react";
import { ChevronRight, Wrench } from "lucide-react";
import { type FC, useState } from "react";
import type {
  Conversation,
  SidechainConversation,
} from "@/lib/conversation-schema";
import type { ToolResultContent } from "@/lib/conversation-schema/content/ToolResultContentSchema";
import type { AssistantMessageContent } from "@/lib/conversation-schema/message/AssistantMessageSchema";
import { formatLocaleDate } from "@/lib/date/formatLocaleDate";
import type { SupportedLocale } from "@/lib/i18n/schema";
import { cn } from "@/lib/utils";
import { parseUserMessage } from "@/server/core/claude-code/functions/parseUserMessage";
import { ArtifactCard } from "./ArtifactCard";
import { AssistantConversationContent } from "./AssistantConversationContent";
import { FileHistorySnapshotConversationContent } from "./FileHistorySnapshotConversationContent";
import { MetaConversationContent } from "./MetaConversationContent";
import { QueueOperationConversationContent } from "./QueueOperationConversationContent";
import { SummaryConversationContent } from "./SummaryConversationContent";
import { SystemConversationContent } from "./SystemConversationContent";
import { TurnDuration } from "./TurnDuration";
import { UserConversationContent } from "./UserConversationContent";

/**
 * Groups consecutive tool_use content blocks into runs of tool calls and text/other blocks.
 */
type ContentGroup =
  | {
      kind: "tool-run";
      items: (AssistantMessageContent & { type: "tool_use" })[];
    }
  | { kind: "other"; item: AssistantMessageContent };

function groupContentForCompact(
  content: AssistantMessageContent[],
): ContentGroup[] {
  const groups: ContentGroup[] = [];
  let currentToolRun: (AssistantMessageContent & { type: "tool_use" })[] = [];

  const flushToolRun = () => {
    if (currentToolRun.length > 0) {
      groups.push({ kind: "tool-run", items: [...currentToolRun] });
      currentToolRun = [];
    }
  };

  for (const block of content) {
    if (block.type === "tool_use") {
      currentToolRun.push(block);
    } else {
      flushToolRun();
      groups.push({ kind: "other", item: block });
    }
  }
  flushToolRun();

  return groups;
}

const CompactToolCallGroup: FC<{
  items: (AssistantMessageContent & { type: "tool_use" })[];
  getToolResult: (toolUseId: string) => ToolResultContent | undefined;
  getAgentIdForToolUse: (toolUseId: string) => string | undefined;
  getSidechainConversationByAgentId: (
    agentId: string,
  ) => SidechainConversation | undefined;
  getSidechainConversationByPrompt: (
    prompt: string,
  ) => SidechainConversation | undefined;
  getSidechainConversations: (rootUuid: string) => SidechainConversation[];
  projectId: string;
  sessionId: string;
}> = ({
  items,
  getToolResult,
  getAgentIdForToolUse,
  getSidechainConversationByAgentId,
  getSidechainConversationByPrompt,
  getSidechainConversations,
  projectId,
  sessionId,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors cursor-pointer"
      >
        <Wrench className="h-2.5 w-2.5" />
        <span className="font-medium">{items.length}</span>
        <ChevronRight
          className={cn(
            "h-2.5 w-2.5 transition-transform",
            isExpanded && "rotate-90",
          )}
        />
      </button>
      {isExpanded && (
        <ul className="w-full mt-1">
          {items.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Order is static
            <li key={index}>
              <AssistantConversationContent
                content={item}
                getToolResult={getToolResult}
                getAgentIdForToolUse={getAgentIdForToolUse}
                getSidechainConversationByAgentId={
                  getSidechainConversationByAgentId
                }
                getSidechainConversationByPrompt={
                  getSidechainConversationByPrompt
                }
                getSidechainConversations={getSidechainConversations}
                projectId={projectId}
                sessionId={sessionId}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const ConversationItem: FC<{
  conversation: Conversation;
  getToolResult: (toolUseId: string) => ToolResultContent | undefined;
  getAgentIdForToolUse: (toolUseId: string) => string | undefined;
  getTurnDuration: (uuid: string) => number | undefined;
  isRootSidechain: (conversation: Conversation) => boolean;
  getSidechainConversationByAgentId: (
    agentId: string,
  ) => SidechainConversation | undefined;
  getSidechainConversationByPrompt: (
    prompt: string,
  ) => SidechainConversation | undefined;
  getSidechainConversations: (rootUuid: string) => SidechainConversation[];
  existsRelatedTaskCall: (prompt: string) => boolean;
  projectId: string;
  sessionId: string;
  showTimestamp?: boolean;
  artifactsById: Map<
    string,
    {
      id: string;
      title: string;
      type: string;
      summary: string | null;
      latestVersion: number;
    }
  >;
  isCompact?: boolean;
}> = ({
  conversation,
  getToolResult,
  getAgentIdForToolUse,
  getTurnDuration,
  getSidechainConversationByPrompt,
  getSidechainConversations,
  getSidechainConversationByAgentId,
  projectId,
  sessionId,
  showTimestamp = true,
  artifactsById,
  isCompact = false,
}) => {
  const { i18n } = useLingui();
  const locale = (i18n.locale as SupportedLocale) || "en";

  if (conversation.type === "summary") {
    return (
      <SummaryConversationContent>
        {conversation.summary}
      </SummaryConversationContent>
    );
  }

  if (conversation.type === "system") {
    // Format system message with full details based on subtype
    const formatSystemMessage = () => {
      const lines: string[] = [];

      // Add subtype label if available
      if ("subtype" in conversation && conversation.subtype) {
        lines.push(`[${conversation.subtype}]`);
      }

      // Add level if available
      if ("level" in conversation && conversation.level) {
        lines.push(`Level: ${conversation.level}`);
      }

      // Handle content field
      if (
        "content" in conversation &&
        typeof conversation.content === "string"
      ) {
        lines.push(`\n${conversation.content}`);
      }

      // Handle stop_hook_summary
      if (conversation.subtype === "stop_hook_summary") {
        lines.push(`Hook Count: ${conversation.hookCount}`);
        lines.push(`Stop Reason: ${conversation.stopReason}`);
        lines.push(
          `Prevented Continuation: ${conversation.preventedContinuation}`,
        );
        lines.push(`Has Output: ${conversation.hasOutput}`);
        if (conversation.hookInfos.length > 0) {
          lines.push(
            `Commands: ${conversation.hookInfos.map((h) => h.command).join(", ")}`,
          );
        }
        if (conversation.hookErrors.length > 0) {
          lines.push(
            `Errors: ${JSON.stringify(conversation.hookErrors, null, 2)}`,
          );
        }
      }

      // Handle turn_duration
      if (conversation.subtype === "turn_duration") {
        lines.push(`Duration: ${(conversation.durationMs / 1000).toFixed(2)}s`);
      }

      // Handle compact_boundary
      if (
        conversation.subtype === "compact_boundary" &&
        conversation.compactMetadata
      ) {
        lines.push(`Trigger: ${conversation.compactMetadata.trigger}`);
        lines.push(`Pre-Tokens: ${conversation.compactMetadata.preTokens}`);
      }

      // Handle api_error
      if (conversation.subtype === "api_error" && "error" in conversation) {
        const error = conversation.error;
        if (error.status !== undefined) {
          lines.push(`Status: ${error.status}`);
        }
        if (error.requestID) {
          lines.push(`Request ID: ${error.requestID}`);
        }
        // Extract error message
        const errorMsg =
          error?.error?.error?.message ||
          error?.error?.message ||
          (error?.error ? JSON.stringify(error.error, null, 2) : null);
        if (errorMsg) {
          lines.push(`Error: ${errorMsg}`);
        }
        // Retry info
        if (conversation.retryAttempt !== undefined) {
          lines.push(
            `Retry: ${conversation.retryAttempt}/${conversation.maxRetries}`,
          );
        }
        if (conversation.retryInMs !== undefined) {
          lines.push(
            `Retry In: ${(conversation.retryInMs / 1000).toFixed(2)}s`,
          );
        }
      }

      // Handle toolUseID
      if ("toolUseID" in conversation && conversation.toolUseID) {
        lines.push(`Tool Use ID: ${conversation.toolUseID}`);
      }

      // Handle slug
      if ("slug" in conversation && conversation.slug) {
        lines.push(`Slug: ${conversation.slug}`);
      }

      return lines.join("\n");
    };

    return (
      <SystemConversationContent>
        {formatSystemMessage()}
      </SystemConversationContent>
    );
  }

  if (conversation.type === "file-history-snapshot") {
    return (
      <FileHistorySnapshotConversationContent conversation={conversation} />
    );
  }

  if (conversation.type === "queue-operation") {
    return <QueueOperationConversationContent conversation={conversation} />;
  }

  if (conversation.type === "user") {
    if (typeof conversation.message.content === "string") {
      const parsed = parseUserMessage(conversation.message.content);

      if (parsed.kind === "local-command") {
        const assistantContent: AssistantMessageContent = {
          type: "text",
          text: parsed.stdout,
        };

        return (
          <div className="w-full">
            {showTimestamp && conversation.timestamp && (
              <div className="text-xs text-muted-foreground mb-1 px-1 select-none text-left">
                {formatLocaleDate(conversation.timestamp, {
                  locale,
                  target: "datetime",
                })}
              </div>
            )}
            <ul className="w-full">
              <li>
                <AssistantConversationContent
                  content={assistantContent}
                  getToolResult={getToolResult}
                  getAgentIdForToolUse={getAgentIdForToolUse}
                  getSidechainConversationByAgentId={
                    getSidechainConversationByAgentId
                  }
                  getSidechainConversationByPrompt={
                    getSidechainConversationByPrompt
                  }
                  getSidechainConversations={getSidechainConversations}
                  projectId={projectId}
                  sessionId={sessionId}
                />
              </li>
            </ul>
          </div>
        );
      }
    }

    const userConversationJsx =
      typeof conversation.message.content === "string" ? (
        <UserConversationContent
          content={conversation.message.content}
          id={`message-${conversation.uuid}`}
        />
      ) : (
        <ul className="w-full" id={`message-${conversation.uuid}`}>
          {conversation.message.content.map((content, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Order is static
            <li key={index}>
              <UserConversationContent content={content} />
            </li>
          ))}
        </ul>
      );

    const timestamp =
      showTimestamp && !isCompact && conversation.timestamp ? (
        <div className="text-xs text-muted-foreground mb-1 px-1 select-none text-right">
          {formatLocaleDate(conversation.timestamp, {
            locale,
            target: "datetime",
          })}
        </div>
      ) : null;

    return conversation.isMeta === true ? (
      // 展開可能にしてデフォで非展開
      <MetaConversationContent>
        <div
          className={cn(
            "flex flex-col w-full",
            isCompact &&
              "compact-content [&_.mb-5]:mb-1 [&_.py-3]:py-1 [&_.mb-3]:mb-1",
          )}
        >
          {timestamp}
          {userConversationJsx}
        </div>
      </MetaConversationContent>
    ) : (
      <div
        className={cn(
          "flex flex-col w-full",
          isCompact &&
            "compact-content [&_.mb-5]:mb-1 [&_.py-3]:py-1 [&_.mb-3]:mb-1",
        )}
      >
        {timestamp}
        {userConversationJsx}
      </div>
    );
  }

  if (conversation.type === "assistant") {
    const turnDuration = getTurnDuration(conversation.uuid);

    // Scan text content for [artifact:<id>] tags
    const artifactPattern = /\[artifact:([a-f0-9]+)\]/g;
    const referencedArtifacts: Array<
      NonNullable<ReturnType<typeof artifactsById.get>>
    > = [];
    for (const content of conversation.message.content) {
      if (content.type === "text") {
        let match = artifactPattern.exec(content.text);
        while (match !== null) {
          const artifactId = match[1];
          if (artifactId) {
            const artifact = artifactsById.get(artifactId);
            if (artifact) {
              referencedArtifacts.push(artifact);
            }
          }
          match = artifactPattern.exec(content.text);
        }
      }
    }

    if (isCompact) {
      const groups = groupContentForCompact(conversation.message.content);

      return (
        <div className="w-full">
          {groups.map((group, groupIndex) => {
            if (group.kind === "tool-run") {
              return (
                <CompactToolCallGroup
                  // biome-ignore lint/suspicious/noArrayIndexKey: Order is static
                  key={groupIndex}
                  items={group.items}
                  getToolResult={getToolResult}
                  getAgentIdForToolUse={getAgentIdForToolUse}
                  getSidechainConversationByAgentId={
                    getSidechainConversationByAgentId
                  }
                  getSidechainConversationByPrompt={
                    getSidechainConversationByPrompt
                  }
                  getSidechainConversations={getSidechainConversations}
                  projectId={projectId}
                  sessionId={sessionId}
                />
              );
            }
            return (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: Order is static
                key={groupIndex}
                className="[&_.my-4]:my-0.5 [&_.sm\:my-6]:my-0.5"
              >
                <AssistantConversationContent
                  content={group.item}
                  getToolResult={getToolResult}
                  getAgentIdForToolUse={getAgentIdForToolUse}
                  getSidechainConversationByAgentId={
                    getSidechainConversationByAgentId
                  }
                  getSidechainConversationByPrompt={
                    getSidechainConversationByPrompt
                  }
                  getSidechainConversations={getSidechainConversations}
                  projectId={projectId}
                  sessionId={sessionId}
                />
              </div>
            );
          })}
          {referencedArtifacts.map((artifact) => (
            <ArtifactCard
              key={artifact.id}
              id={artifact.id}
              title={artifact.title}
              type={artifact.type}
              summary={artifact.summary}
              latestVersion={artifact.latestVersion}
            />
          ))}
          {turnDuration !== undefined && (
            <TurnDuration durationMs={turnDuration} />
          )}
        </div>
      );
    }

    return (
      <div className="w-full">
        {showTimestamp && conversation.timestamp && (
          <div className="text-xs text-muted-foreground mb-1 px-1 select-none text-left">
            {formatLocaleDate(conversation.timestamp, {
              locale,
              target: "datetime",
            })}
          </div>
        )}
        <ul className="w-full">
          {conversation.message.content.map((content, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Order is static
            <li key={index}>
              <AssistantConversationContent
                content={content}
                getToolResult={getToolResult}
                getAgentIdForToolUse={getAgentIdForToolUse}
                getSidechainConversationByAgentId={
                  getSidechainConversationByAgentId
                }
                getSidechainConversationByPrompt={
                  getSidechainConversationByPrompt
                }
                getSidechainConversations={getSidechainConversations}
                projectId={projectId}
                sessionId={sessionId}
              />
            </li>
          ))}
        </ul>
        {referencedArtifacts.map((artifact) => (
          <ArtifactCard
            key={artifact.id}
            id={artifact.id}
            title={artifact.title}
            type={artifact.type}
            summary={artifact.summary}
            latestVersion={artifact.latestVersion}
          />
        ))}
        {turnDuration !== undefined && (
          <TurnDuration durationMs={turnDuration} />
        )}
      </div>
    );
  }

  return null;
};
