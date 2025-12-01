/**
 * Feed Algorithm Service
 * Scores and ranks feed items based on multiple factors:
 * - Relationship (groups, following)
 * - Recency
 * - Engagement (likes, comments)
 * - Relevance (location, vehicle type)
 */

class FeedAlgorithmService {
    /**
     * Calculate relationship score (0-40 points)
     * @param {Object} ride - The ride object
     * @param {string} currentUserId - Current user's ID
     * @param {Array} userGroups - User's group IDs
     * @param {Array} following - User IDs the current user follows
     * @returns {number} Score 0-40
     */
    calculateRelationshipScore(ride, currentUserId, userGroups = [], following = []) {
        let score = 0;

        // User's own content gets highest priority
        if (ride.userId === currentUserId) {
            return 40;
        }

        // Check if ride author is in same group
        if (ride.groupId && userGroups.includes(ride.groupId)) {
            score += 40;
        }

        // Check if user follows the ride author
        if (following.includes(ride.userId)) {
            score += 30;
        }

        // Discovery score - give some points even for unknown users
        if (score === 0) {
            score = 5;
        }

        return Math.min(score, 40);
    }

    /**
     * Calculate recency score (0-25 points)
     * @param {string|number} timestamp - Ride timestamp
     * @returns {number} Score 0-25
     */
    calculateRecencyScore(timestamp) {
        if (!timestamp) return 5;

        const now = Date.now();
        const rideTime = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
        const ageMs = now - rideTime;
        const ageHours = ageMs / (1000 * 60 * 60);
        const ageDays = ageHours / 24;

        if (ageHours < 24) {
            // Last 24 hours - exponential decay
            const hourScore = 25 * Math.exp(-ageHours / 12);
            return Math.max(hourScore, 20);
        } else if (ageDays < 7) {
            // Last week
            return 20 - (ageDays * 2);
        } else if (ageDays < 30) {
            // Last month
            return 15 - (ageDays / 2);
        } else {
            // Older
            return 5;
        }
    }

    /**
     * Calculate engagement score (0-20 points)
     * @param {Object} ride - The ride object with engagement metrics
     * @param {string|number} timestamp - Ride timestamp for normalization
     * @returns {number} Score 0-20
     */
    calculateEngagementScore(ride, timestamp) {
        const likesCount = ride.likesCount || 0;
        const commentsCount = ride.commentsCount || 0;

        // Weight comments more than likes
        const rawEngagement = (likesCount * 1) + (commentsCount * 3);

        // Normalize by age (older posts need more engagement for same score)
        const now = Date.now();
        const rideTime = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
        const ageHours = (now - rideTime) / (1000 * 60 * 60);
        const ageFactor = Math.max(1, ageHours / 24); // 1x for first day, increases after

        const normalizedEngagement = rawEngagement / ageFactor;

        // Convert to 0-20 scale (logarithmic to prevent viral posts from dominating)
        const score = Math.log(normalizedEngagement + 1) * 5;
        return Math.min(score, 20);
    }

    /**
     * Calculate relevance score (0-15 points)
     * @param {Object} ride - The ride object
     * @param {Object} userPreferences - User's preferences
     * @returns {number} Score 0-15
     */
    calculateRelevanceScore(ride, userPreferences = {}) {
        let score = 0;

        // Vehicle type preference
        const preferredVehicles = userPreferences.preferredVehicles || ['car'];
        if (preferredVehicles.includes(ride.vehicle)) {
            score += 10;
        }

        // Location relevance (if user has home location)
        if (userPreferences.homeLocation && ride.startCity) {
            // Simple city match for now (could be enhanced with actual distance calculation)
            if (ride.startCity === userPreferences.homeCity ||
                ride.endCity === userPreferences.homeCity) {
                score += 10;
            }
        }

        // Nearby content bonus (if enabled)
        if (userPreferences.showNearbyContent !== false) {
            // Could add distance-based scoring here
            score += 5;
        }

        return Math.min(score, 15);
    }

    /**
     * Calculate total score for a feed item
     * @param {Object} ride - The ride object
     * @param {string} currentUserId - Current user's ID
     * @param {Object} context - Additional context (groups, following, preferences)
     * @returns {Object} Scored ride with breakdown
     */
    scoreFeedItem(ride, currentUserId, context = {}) {
        const {
            userGroups = [],
            following = [],
            userPreferences = {}
        } = context;

        const timestamp = ride.endTime || ride.startTime || ride.created_at;

        const relationshipScore = this.calculateRelationshipScore(
            ride,
            currentUserId,
            userGroups,
            following
        );

        const recencyScore = this.calculateRecencyScore(timestamp);

        const engagementScore = this.calculateEngagementScore(ride, timestamp);

        const relevanceScore = this.calculateRelevanceScore(ride, userPreferences);

        const totalScore = relationshipScore + recencyScore + engagementScore + relevanceScore;

        return {
            ...ride,
            feedScore: totalScore,
            scoreBreakdown: {
                relationship: relationshipScore,
                recency: recencyScore,
                engagement: engagementScore,
                relevance: relevanceScore,
                total: totalScore
            }
        };
    }

    /**
     * Rank feed items by score
     * @param {Array} rides - Array of rides
     * @param {string} currentUserId - Current user's ID
     * @param {Object} context - Additional context
     * @returns {Array} Sorted array of scored rides
     */
    rankFeedItems(rides, currentUserId, context = {}) {
        const scoredRides = rides.map(ride =>
            this.scoreFeedItem(ride, currentUserId, context)
        );

        // Sort by total score (descending)
        return scoredRides.sort((a, b) => b.feedScore - a.feedScore);
    }

    /**
     * Apply diversity to feed (prevent same user dominating)
     * @param {Array} rankedRides - Already ranked rides
     * @param {Object} options - Diversity options
     * @returns {Array} Diversified feed
     */
    applyDiversity(rankedRides, options = {}) {
        const {
            maxConsecutiveFromSameUser = 2,
            maxPercentageFromSameUser = 0.3
        } = options;

        const result = [];
        const userCounts = {};
        const totalItems = rankedRides.length;
        let consecutiveCount = 0;
        let lastUserId = null;

        for (const ride of rankedRides) {
            const userId = ride.userId;
            const currentCount = userCounts[userId] || 0;

            // Check if adding this would exceed percentage limit
            const wouldExceedPercentage = (currentCount + 1) / (result.length + 1) > maxPercentageFromSameUser;

            // Check consecutive limit
            const isConsecutive = userId === lastUserId;
            if (isConsecutive) {
                consecutiveCount++;
            } else {
                consecutiveCount = 1;
            }

            const wouldExceedConsecutive = consecutiveCount > maxConsecutiveFromSameUser;

            // Skip if would violate diversity rules (unless it's high priority content)
            if ((wouldExceedPercentage || wouldExceedConsecutive) && ride.feedScore < 80) {
                continue;
            }

            result.push(ride);
            userCounts[userId] = currentCount + 1;
            lastUserId = userId;
        }

        return result;
    }

    /**
     * Get personalized feed for user
     * @param {Array} rides - All available rides
     * @param {string} userId - Current user's ID
     * @param {Object} context - User context (groups, following, preferences)
     * @param {Object} options - Feed options
     * @returns {Array} Personalized and ranked feed
     */
    getPersonalizedFeed(rides, userId, context = {}, options = {}) {
        const {
            applyDiversityRules = true,
            limit = 50
        } = options;

        console.log('🧠 [FeedAlgorithm] Input:', { ridesCount: rides.length, userId, applyDiversityRules, limit });

        // Rank all rides
        let rankedFeed = this.rankFeedItems(rides, userId, context);
        console.log('📊 [FeedAlgorithm] Après scoring:', { count: rankedFeed.length, scores: rankedFeed.slice(0, 3).map(r => ({ userId: r.userId, score: r.feedScore })) });

        // Apply diversity if enabled
        if (applyDiversityRules) {
            rankedFeed = this.applyDiversity(rankedFeed, options);
            console.log('🎲 [FeedAlgorithm] Après diversité:', { count: rankedFeed.length });
        }

        // Apply limit
        if (limit) {
            rankedFeed = rankedFeed.slice(0, limit);
        }

        console.log('✅ [FeedAlgorithm] Output final:', { count: rankedFeed.length });
        return rankedFeed;
    }
}

export default new FeedAlgorithmService();
