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
}