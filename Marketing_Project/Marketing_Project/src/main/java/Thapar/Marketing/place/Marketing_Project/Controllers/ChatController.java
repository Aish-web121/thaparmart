package Thapar.Marketing.place.Marketing_Project.Controllers;

import Thapar.Marketing.place.Marketing_Project.Services.ChatService;
import Thapar.Marketing.place.Marketing_Project.dtos.request.SendMessageRequest;
import Thapar.Marketing.place.Marketing_Project.dtos.response.ChatMessageResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import Thapar.Marketing.place.Marketing_Project.Repositories.UserRepository;

import java.util.List;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;
    private final UserRepository userRepository;

    // POST /api/chat/send
    @PostMapping("/send")
    public ResponseEntity<ChatMessageResponse> sendMessage(
            @Valid @RequestBody SendMessageRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        Long senderId = userRepository
                .findByEmail(userDetails.getUsername())
                .orElseThrow().getId();

        return ResponseEntity.ok(chatService.sendMessage(request, senderId));
    }

    // GET /api/chat/conversation?productId=1&otherUserId=2
    @GetMapping("/conversation")
    public ResponseEntity<List<ChatMessageResponse>> getConversation(
            @RequestParam Long productId,
            @RequestParam Long otherUserId,
            @AuthenticationPrincipal UserDetails userDetails) {

        Long myId = userRepository
                .findByEmail(userDetails.getUsername())
                .orElseThrow().getId();

        return ResponseEntity.ok(
                chatService.getConversation(productId, myId, otherUserId));
    }

    // GET /api/chat/inbox
    @GetMapping("/inbox")
    public ResponseEntity<List<ChatMessageResponse>> getInbox(
            @AuthenticationPrincipal UserDetails userDetails) {

        Long myId = userRepository
                .findByEmail(userDetails.getUsername())
                .orElseThrow().getId();

        return ResponseEntity.ok(chatService.getInbox(myId));
    }

    // GET /api/chat/unread-counts
    // Returns a map of "productId-otherUserId" -> unread count for the current user
    @GetMapping("/unread-counts")
    public ResponseEntity<java.util.Map<String, Long>> getUnreadCounts(
            @AuthenticationPrincipal UserDetails userDetails) {

        Long myId = userRepository
                .findByEmail(userDetails.getUsername())
                .orElseThrow().getId();

        return ResponseEntity.ok(chatService.getUnreadCounts(myId));
    }

    // PATCH /api/chat/conversation/read?productId=1&otherUserId=2
    // Called by the receiver when they open a thread.
    // Marks all incoming unread messages as read and notifies
    // the sender via WebSocket so blue ticks appear immediately.
    @PatchMapping("/conversation/read")
    public ResponseEntity<Void> markAsRead(
            @RequestParam Long productId,
            @RequestParam Long otherUserId,
            @AuthenticationPrincipal UserDetails userDetails) {

        Long myId = userRepository
                .findByEmail(userDetails.getUsername())
                .orElseThrow().getId();

        chatService.markAsRead(productId, myId, otherUserId);
        return ResponseEntity.noContent().build();
    }
}
