const logger = require("../../lib/logger");
const mongoose = require("mongoose");

class CoreService {
    constructor(model) {
        if (!model || !(model.prototype instanceof mongoose.Model)) {
            throw new Error("CoreService requires a valid Mongoose Model.");
        }
        this.model = model;
    }

    async _execute(fn, action, params) {
        logger.debug(`[CoreService] ${action} params: ${JSON.stringify(params)}`);
        try {
            return await fn();
        } catch (error) {
            logger.error(`Error executing ${action} on ${this.model.modelName}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Creates a new document in the collection.
     * Note: Uses an arrow function passed to _execute to ensure 'this' refers to the CoreService instance (lexical scoping), allowing access to this.model.
     * @param {Object} data - The data to create the document with.
     * @returns {Promise<Object>} The status and ID of the created document.
     */
    async create(data) {
        return this._execute(async () => {
            const saved = await this.model.create(data);
            return { status: 'saved', _id: saved._id };
        }, 'create', data);
    }

    /**
     * Updates an existing document by ID.
     * 
     * Default behavior:
     * - new: true (Returns the modified document instead of the original)
     * - runValidators: true (Runs update validators against the model's schema)
     * 
     * Can create the document if it doesn't exist by passing { upsert: true } in options.
     * Note: Uses an arrow function passed to _execute to ensure 'this' refers to the CoreService instance (lexical scoping), allowing access to this.model.
     * 
     * @param {string} id - The ID of the document to update.
     * @param {Object} data - The data to update.
     * @param {Object} [options={}] - Additional Mongoose Query options (e.g. { upsert: true }).
     * @returns {Promise<Object|null>} The status and ID of the updated document, or null if not found.
     */
    async update(id, data, options = {}) {
        return this._execute(async () => {
            const finalOptions = { new: true, runValidators: true, ...options };
            const result = await this.model.findByIdAndUpdate(id, data, finalOptions);
            if (!result) {
                logger.warn(`Document with id ${id} not found in ${this.model.modelName} for update.`);
                return null;
            }
            return { status: 'updated', _id: result._id };
        }, 'update', { id, data, options });
    }

    /**
     * Deletes a document by ID.
     * Note: Uses an arrow function passed to _execute to ensure 'this' refers to the CoreService instance (lexical scoping), allowing access to this.model.
     * @param {string} id - The ID of the document to delete.
     * @returns {Promise<Object|null>} The status and ID of the deleted document, or null if not found.
     */
    async delete(id) {
        return this._execute(async () => {
            const result = await this.model.findByIdAndDelete(id);
            if (!result) {
                logger.warn(`Document with id ${id} not found in ${this.model.modelName} for delete.`);
                return null;
            }
            return { status: 'deleted', _id: result._id };
        }, 'delete', { id });
    }

    /**
     * Retrieves a document by ID.
     * Note: Uses an arrow function passed to _execute to ensure 'this' refers to the CoreService instance (lexical scoping), allowing access to this.model.
     * @param {string} id - The ID of the document to retrieve.
     * @returns {Promise<Object|null>} The document if found, or null.
     */
    async findById(id) {
        return this._execute(async () => {
            const result = await this.model.findOne({ _id: id, active: true })
                .select('-created_by -created_at -updated_by -updated_at -active')
                .lean();

            if (!result) {
                logger.warn(`Document with id ${id} not found in ${this.model.modelName}.`);
                return null;
            }
            return result;
        }, 'findById', { id });
    }

    /**
     * Retrieves all documents from the collection with pagination, sorting, and filtering.
     * 
     * How it works:
     * 1. Extracts `page` and `limit` from the query string (defaults to page 1, limit 10).
     * 2. Extracts `sort` parameter (defaults to descending creation date '-created_at').
     * 3. Calculates the `skip` value for pagination.
     * 4. Constructs a `filter` object by excluding special parameters (page, limit, sort) and enforcing `active: true`.
     * 5. Executes two operations in parallel:
     *    - `find`: Retrives the documents matching the filter, applying sort, skip, limit, and field selection.
     *    - `countDocuments`: Counts the total number of documents matching the filter for pagination metadata.
     * 6. Calculates `totalPages` and constructs the response with document data and pagination info.
     * 
     * Note: Uses an arrow function passed to _execute to ensure 'this' refers to the CoreService instance (lexical scoping).
     * 
     * @param {Object} query - Query object containing filters and special params:
     *                       - page: Page number (default: 1)
     *                       - limit: Items per page (default: 10)
     *                       - sort: Sorting criteria (e.g., 'field' or '-field')
     * @returns {Promise<Object>} Object containing:
     *                          - docs: Array of documents found
     *                          - totalDocs: Total number of matching documents
     *                          - limit: Items per page
     *                          - page: Current page
     *                          - totalPages: Total number of pages
     *                          - hasPrevPage: Boolean indicating if previous page exists
     *                          - hasNextPage: Boolean indicating if next page exists
     */
    async findAll(query = {}) {
        return this._execute(async () => {
            // 1. Parse pagination parameters with defaults
            const page = parseInt(query.page, 10) || 1;
            const limit = parseInt(query.limit, 10) || 10;

            // 2. Parse sorting parameter (replace commas with spaces for Mongoose syntax)
            const sort = query.sort ? query.sort.replace(/,/g, ' ') : '-created_at';

            // 3. Calculate skip for pagination
            const skip = (page - 1) * limit;

            // 4. separate actual filters from control parameters
            const filter = { ...query, active: true }; // Enforce active=true constraint
            delete filter.page;
            delete filter.limit;
            delete filter.sort;

            // 5. Run query and count in parallel for efficiency
            const [docs, totalDocs] = await Promise.all([
                this.model.find(filter)
                    .sort(sort)
                    .skip(skip)
                    .limit(limit)
                    .select('-created_by -created_at -updated_by -updated_at -active') // Exclude audit fields
                    .lean(), // Return plain JS objects instead of Mongoose Docs
                this.model.countDocuments(filter)
            ]);

            // 6. Calculate total pages
            const totalPages = Math.ceil(totalDocs / limit);

            // 7. Return standardized response
            return {
                docs,
                totalDocs,
                limit,
                page,
                totalPages,
                hasPrevPage: page > 1,
                hasNextPage: page < totalPages,
            };
        }, 'findAll', query);
    }
}

module.exports = CoreService;