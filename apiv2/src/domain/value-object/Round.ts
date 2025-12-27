import { ValidationError } from "../../shared/errors/index.js";
import { RoundStatus } from "./RoundStatus.js";
import { SubRound } from "./SubRound.js";

export class Round {
    constructor(
        public readonly id: string,
        public readonly subRounds: SubRound[],
        public status: RoundStatus,
        public readonly startTime: number,
        public winnerId?: string,
        public endTime?: number
    ) {
        this.validateId(id);
        this.validateSubRounds(subRounds);
        this.validateStatus(status);
        this.validateStartTime(startTime);
        if (winnerId !== undefined) {
            this.validateWinnerId(winnerId);
        }
        if (endTime !== undefined) {
            this.validateEndTime(endTime);
        }
    }

    /**
     * Set the status of this round
     * Modifies the status field in place
     */
    setStatus(status: RoundStatus): void {
        this.validateStatus(status);
        this.status = status;
    }

    /**
     * Finish this round
     * Sets status to Finished
     */
    finish(): void {
        this.status = RoundStatus.Finished;
    }

    /**
     * Convert to JSON representation
     */
    toJSON(): object {
        return {
            id: this.id,
            subRounds: this.subRounds.map(subRound => subRound.toJSON()),
            status: this.status,
            startTime: this.startTime,
            winnerId: this.winnerId,
            endTime: this.endTime
        };
    }

    /**
     * Create a new Round from JSON data
     */
    static fromJSON(data: any): Round {
        if (!data || typeof data !== 'object') {
            throw new ValidationError('Invalid round data: must be an object');
        }

        if (!data.id || typeof data.id !== 'string') {
            throw new ValidationError('Round ID is required and must be a string');
        }

        if (!Array.isArray(data.subRounds)) {
            throw new ValidationError('Round subRounds must be an array');
        }

        if (!data.status || typeof data.status !== 'string') {
            throw new ValidationError('Round status is required and must be a string');
        }

        if (!Object.values(RoundStatus).includes(data.status as RoundStatus)) {
            throw new ValidationError(`Invalid status: ${data.status}. Must be one of: ${Object.values(RoundStatus).join(', ')}`);
        }

        if (typeof data.startTime !== 'number') {
            throw new ValidationError('Round startTime is required and must be a number');
        }

        const subRounds = data.subRounds.map((subRoundData: any) => SubRound.fromJSON(subRoundData));
        return new Round(
            data.id, 
            subRounds, 
            data.status as RoundStatus, 
            data.startTime,
            data.winnerId,
            data.endTime
        );
    }

    private validateId(id: string): void {
        if (!id || typeof id !== 'string') {
            throw new ValidationError('Round ID is required and must be a string');
        }

        if (id.trim().length === 0) {
            throw new ValidationError('Round ID cannot be empty');
        }

        // ID validation pattern: alphanumeric, dots, hyphens, underscores, 1-128 chars
        if (!/^[a-zA-Z0-9._-]{1,128}$/.test(id)) {
            throw new ValidationError(
                `Invalid round id: ${id}. Must match pattern ^[a-zA-Z0-9._-]{1,128}$`
            );
        }
    }

    private validateSubRounds(subRounds: SubRound[]): void {
        if (!Array.isArray(subRounds)) {
            throw new ValidationError('Round subRounds must be an array');
        }

        // Validate each sub-round
        subRounds.forEach((subRound, index) => {
            if (!(subRound instanceof SubRound)) {
                throw new ValidationError(`SubRound at index ${index} must be a SubRound instance`);
            }
        });
    }

    private validateStatus(status: RoundStatus): void {
        if (!status || !Object.values(RoundStatus).includes(status)) {
            throw new ValidationError(`status must be one of: ${Object.values(RoundStatus).join(', ')}`);
        }
    }

    private validateStartTime(startTime: number): void {
        if (typeof startTime !== 'number') {
            throw new ValidationError('Round startTime must be a number');
        }

        if (!Number.isInteger(startTime)) {
            throw new ValidationError('Round startTime must be an integer');
        }

        if (startTime < 0) {
            throw new ValidationError('Round startTime must be a positive number');
        }

        // Check if it's a reasonable Unix timestamp (after 1970, before year 3000)
        const minTimestamp = 0; // January 1, 1970
        const maxTimestamp = 32503680000000; // January 1, 3000
        
        if (startTime < minTimestamp || startTime > maxTimestamp) {
            throw new ValidationError('Round startTime must be a valid Unix timestamp in milliseconds');
        }
    }

    private validateWinnerId(winnerId: string): void {
        if (!winnerId || typeof winnerId !== 'string') {
            throw new ValidationError('Round winnerId must be a non-empty string');
        }

        if (winnerId.trim().length === 0) {
            throw new ValidationError('Round winnerId cannot be empty');
        }

        // User ID validation pattern: alphanumeric, dots, hyphens, underscores, 1-128 chars
        if (!/^[a-zA-Z0-9._-]{1,128}$/.test(winnerId)) {
            throw new ValidationError(
                `Invalid round winnerId: ${winnerId}. Must match pattern ^[a-zA-Z0-9._-]{1,128}$`
            );
        }
    }

    private validateEndTime(endTime: number): void {
        if (typeof endTime !== 'number') {
            throw new ValidationError('Round endTime must be a number');
        }

        if (!Number.isFinite(endTime)) {
            throw new ValidationError('Round endTime must be a finite number');
        }

        if (!Number.isInteger(endTime)) {
            throw new ValidationError('Round endTime must be an integer');
        }

        if (endTime < 0) {
            throw new ValidationError('Round endTime must be a positive number');
        }

        // Check if it's a reasonable Unix timestamp (after 1970, before year 3000)
        const minTimestamp = 0; // January 1, 1970
        const maxTimestamp = 32503680000000; // January 1, 3000
        
        if (endTime < minTimestamp || endTime > maxTimestamp) {
            throw new ValidationError('Round endTime must be a valid Unix timestamp in milliseconds');
        }

        // Validate that endTime is not before startTime
        if (endTime < this.startTime) {
            throw new ValidationError('Round endTime must be greater than or equal to startTime');
        }
    }

}