'use strict';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInteger(value) {
  return Number.isInteger(Number(value)) && Number(value) > 0;
}

function isValidEmail(value) {
  if (typeof value !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function isValidTime(value) {
  if (typeof value !== 'string') return false;
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);
}

function validationError(res, details) {
  return res.status(400).json({
    error: 'Validation error',
    details,
  });
}

/**
 * Parse and validate pagination query parameters
 * Supports both limit/offset and page-based pagination
 * @param {Object} query - Express query object
 * @returns {Object} - { limit, offset }
 */
function parsePaginationParams(query) {
  const limit = Math.min(Math.max(parseInt(query.limit) || 20, 1), 100);
  const offset = Math.max(parseInt(query.offset) || 0, 0);
  return { limit, offset };
}

/**
 * Parse and validate sort parameter
 * Format: "field1:asc,field2:desc"
 * @param {String} sortParam - Sort parameter string
 * @param {String[]} allowedFields - List of allowed sort fields
 * @returns {Array} - Sequelize order format [[field, direction], ...]
 */
function parseSortParams(sortParam, allowedFields = []) {
  if (!sortParam) return [];

  const order = [];
  const sorts = sortParam.split(',');

  for (const sort of sorts) {
    const [field, direction] = sort.trim().split(':');
    const safeField = field?.trim();
    const safeDirection = (direction?.trim()?.toUpperCase() || 'ASC');

    // Validate field if allowedFields specified
    if (allowedFields.length && !allowedFields.includes(safeField)) {
      continue;
    }

    // Validate direction
    if (!['ASC', 'DESC'].includes(safeDirection)) {
      continue;
    }

    order.push([safeField, safeDirection]);
  }

  return order;
}

/**
 * Build Sequelize where clause for text search
 * @param {String[]} fields - Fields to search (e.g., ['name', 'description'])
 * @param {String} searchTerm - Search term
 * @returns {Object} - Sequelize where clause
 */
function buildSearchWhere(fields, searchTerm) {
  if (!searchTerm || !fields.length) return {};

  const { Op } = require('sequelize');
  const conditions = fields.map(field => ({
    [field]: { [Op.like]: `%${searchTerm}%` }
  }));

  return { [Op.or]: conditions };
}

/**
 * Add pagination metadata to response
 * @param {Object} data - Response data array
 * @param {Number} total - Total record count
 * @param {Number} limit - Records per page
 * @param {Number} offset - Current offset
 * @returns {Object} - Response with metadata
 */
function paginatedResponse(data, total, limit, offset) {
  return {
    data,
    pagination: {
      total,
      limit,
      offset,
      pages: Math.ceil(total / limit),
      currentPage: Math.floor(offset / limit) + 1,
    },
  };
}

module.exports = {
  isNonEmptyString,
  isPositiveInteger,
  isValidEmail,
  isValidDateOnly,
  isValidTime,
  validationError,
  parsePaginationParams,
  parseSortParams,
  buildSearchWhere,
  paginatedResponse,
};
