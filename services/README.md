# Services

This folder contains all business logic and API integration services.

## Structure

```
services/
├── core/               # Core utilities
│   ├── offlineService.js
│   ├── geocodingService.js
│   ├── ProfilePhoto.js
│   └── Vehicles.js
├── tracking/           # Location & ride tracking
│   ├── BackgroundLocationService.js
│   ├── RideAnalysisService.js
│   └── RideStorage.js
├── supabase/           # Supabase integrations
│   ├── challengeParticipationService.js
│   ├── challengeRankingsService.js
│   ├── groupMembersService.js
│   ├── invitationsService.js
│   ├── rideCommentsService.js
│   ├── ridesService.js
│   ├── socialService.js
│   └── uploadsService.js
├── ChallengesService.js  # Domain services (root)
├── GroupsService.js
└── PostsService.js
```

## Service Patterns

### CRUD Operations
All services should follow this pattern:
```javascript
class ServiceName {
  // Read
  async getById(id) {}
  async getAll(filters = {}) {}
  
  // Create
  async create(data) {}
  
  // Update
  async update(id, data) {}
  
  // Delete
  async delete(id) {}
}
```

### Error Handling
```javascript
try {
  const result = await operation();
  return { data: result, error: null };
} catch (error) {
  console.error('[ServiceName]', error);
  return { data: null, error };
}
```

## Best Practices

1. **Single Responsibility**: Each service handles one domain
2. **Consistent Returns**: Always return `{ data, error }`
3. **Error Logging**: Prefix logs with service name
4. **Offline Support**: Use offline service for queue management
5. **Type Safety**: Add JSDoc comments for parameters

## Usage Examples

### Tracking Service
```javascript
import { RideStorage } from './tracking/RideStorage';

const ride = await RideStorage.saveRide(rideData);
```

### Supabase Service
```javascript
import ridesService from './supabase/ridesService';

const { data, error } = await ridesService.uploadRide(ride);
```
