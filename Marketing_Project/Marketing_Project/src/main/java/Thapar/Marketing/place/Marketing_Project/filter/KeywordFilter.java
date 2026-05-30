package Thapar.Marketing.place.Marketing_Project.filter;

import Thapar.Marketing.place.Marketing_Project.exceptions.IllegalItemException;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

@Component
public class KeywordFilter {

    // ── You can grow this list anytime from Admin panel ───────────
    private static final List<String> BANNED_KEYWORDS = Arrays.asList(
            "gun", "pistol", "rifle", "weapon", "knife", "blade",
            "drugs", "weed", "cocaine", "heroin", "marijuana", "opium",
            "alcohol", "beer", "whiskey", "wine", "vodka",
            "cigarette", "tobacco", "vape",
            "fake id", "fake degree", "forged",
            "porn", "adult", "explicit",
            "bomb", "explosive", "grenade",
            "stolen", "theft", "illegal","maal","ganja"
    );

    public void validate(String title, String description) {
        String combined = (title + " " + description).toLowerCase();

        for (String keyword : BANNED_KEYWORDS) {
            if (combined.contains(keyword.toLowerCase())) {
                throw new IllegalItemException(
                        "Your listing contains prohibited content: '"
                                + keyword + "'. This violates marketplace policy.");
            }
        }
    }

    // ── Called by Admin to check current list ─────────────────────
    public List<String> getBannedKeywords() {
        return BANNED_KEYWORDS;
    }
}