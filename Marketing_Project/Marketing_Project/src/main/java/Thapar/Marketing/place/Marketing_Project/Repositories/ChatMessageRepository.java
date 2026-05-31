package Thapar.Marketing.place.Marketing_Project.Repositories;

import Thapar.Marketing.place.Marketing_Project.Entities.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    // Full conversation between two users about a product
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

    // Inbox: only the LATEST message per thread (not all messages)
    // This prevents old unread messages from inflating counts
    @Query("""
        SELECT m FROM ChatMessage m
        WHERE m.id IN (
            SELECT MAX(m2.id) FROM ChatMessage m2
            WHERE m2.sender.id = :userId OR m2.receiver.id = :userId
            GROUP BY m2.product.id,
                CASE WHEN m2.sender.id = :userId THEN m2.receiver.id
                     ELSE m2.sender.id END
        )
        ORDER BY m.sentAt DESC
    """)
    List<ChatMessage> findAllByUser(@Param("userId") Long userId);

    // Count truly unread messages in a thread for the current user
    @Query("""
        SELECT COUNT(m) FROM ChatMessage m
        WHERE m.product.id = :productId
        AND m.receiver.id = :userId
        AND m.sender.id = :otherUserId
        AND m.read = false
    """)
    long countUnread(
            @Param("productId") Long productId,
            @Param("userId") Long userId,
            @Param("otherUserId") Long otherUserId
    );

    // All unread messages where current user is receiver — for computing per-thread counts
    @Query("""
        SELECT m FROM ChatMessage m
        WHERE m.receiver.id = :userId
        AND m.read = false
    """)
    List<ChatMessage> findUnreadReceivedMessages(@Param("userId") Long userId);

    // Mark all unread messages in a thread as read in one query
    @Modifying
    @Query("""
        UPDATE ChatMessage m
        SET m.read = true
        WHERE m.product.id = :productId
        AND m.receiver.id = :readerId
        AND m.sender.id = :senderId
        AND m.read = false
    """)
    int markAllAsRead(
            @Param("productId") Long productId,
            @Param("readerId") Long readerId,
            @Param("senderId") Long senderId
    );
}
