package Thapar.Marketing.place.Marketing_Project.Repositories;

import Thapar.Marketing.place.Marketing_Project.Entities.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    // get full conversation between two users about a product
    @Query("""
        SELECT m FROM ChatMessage m
        WHERE m.product.id = :productId
        AND (
            (m.sender.id = :userId1 AND m.receiver.id = :userId2)
            OR
            (m.sender.id = :userId2 AND m.receiver.id = :userId1)
        )
        ORDER BY m.sentAt ASC
    """)
    List<ChatMessage> findConversation(
            @Param("productId") Long productId,
            @Param("userId1") Long userId1,
            @Param("userId2") Long userId2
    );

    // get all conversations for a user (inbox)
    @Query("""
        SELECT m FROM ChatMessage m
        WHERE m.sender.id = :userId OR m.receiver.id = :userId
        ORDER BY m.sentAt DESC
    """)
    List<ChatMessage> findAllByUser(@Param("userId") Long userId);
}