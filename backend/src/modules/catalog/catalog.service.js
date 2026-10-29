import mongoose from 'mongoose';
import { Category } from './category.model.js';
import { Service } from './service.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { transaction } from '../../utils/transaction.js';
import { recordAudit } from '../admin/audit.model.js';
export const categoryDTO = c => ({ id: c.id, name: c.name, slug: c.slug, description: c.description, icon: c.icon, isActive: c.isActive, sortOrder: c.sortOrder });
export const serviceDTO = s => ({ id: s.id, category: String(s.category), name: s.name, slug: s.slug, description: s.description, isActive: s.isActive });
function values(input, creating) {
  const value = { ...input };
  if (input.name) value.nameKey = input.name.toLocaleLowerCase('en');
  if (creating && !value.slug) value.slug = input.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (creating && !value.slug) throw new ApiError(400, 'SLUG_REQUIRED', 'Provide an ASCII slug for this name');
  return value;
}
export async function activeServices(ids, session = null) {
  if (!ids.length) return [];
  const categories = await Category.find({ isActive: true }).select('_id').session(session);
  const services = await Service.find({ _id: mongoose.trusted({ $in: ids }), isActive: true, category: mongoose.trusted({ $in: categories.map(c => c._id) }) }).session(session);
  if (services.length !== ids.length) throw new ApiError(400, 'INVALID_SERVICES', 'Select existing services from active categories');
  return services;
}
export const catalogService = {
  async listCategories(paging, admin = false) {
    const data = await Category.find(admin ? {} : { isActive: true }).sort({ sortOrder: 1, name: 1 }).skip((paging.page - 1) * paging.limit).limit(paging.limit);
    return { categories: data.map(categoryDTO), ...paging };
  },
  async listServices(paging, categoryId, admin = false) {
    const filter = {};
    if (categoryId) {
      const category = await Category.findOne({ _id: categoryId, ...(admin ? {} : { isActive: true }) });
      if (!category) throw new ApiError(404, 'NOT_FOUND', 'Category not found');
      filter.category = categoryId;
    } else if (!admin) {
      const categories = await Category.find({ isActive: true }).select('_id');
      filter.category = mongoose.trusted({ $in: categories.map(c => c._id) });
    }
    if (!admin) filter.isActive = true;
    const data = await Service.find(filter).sort({ name: 1 }).skip((paging.page - 1) * paging.limit).limit(paging.limit);
    return { services: data.map(serviceDTO), ...paging };
  },
  async create(kind, input, actor) {
    const model = kind === 'Category' ? Category : Service;
    try {
      return await transaction(async session => {
        if (kind === 'Service' && !await Category.exists({ _id: input.category, isActive: true }).session(session)) throw new ApiError(400, 'INVALID_CATEGORY', 'Choose an active category');
        const [doc] = await model.create([values(input, true)], { session });
        await recordAudit(actor, kind.toUpperCase() + '_CREATED', kind, doc._id, Object.keys(input), session);
        return kind === 'Category' ? categoryDTO(doc) : serviceDTO(doc);
      });
    } catch (error) {
      if (error.code === 11000) throw new ApiError(409, 'CATALOG_EXISTS', 'This catalog name or slug already exists');
      throw error;
    }
  },
  async update(kind, id, input, actor) {
    const model = kind === 'Category' ? Category : Service;
    try {
      return await transaction(async session => {
        const doc = await model.findByIdAndUpdate(id, { $set: values(input, false) }, { new: true, runValidators: true, session });
        if (!doc) throw new ApiError(404, 'NOT_FOUND', kind + ' not found');
        if (kind === 'Service' && input.isActive === true && !await Category.exists({ _id: doc.category, isActive: true }).session(session)) throw new ApiError(400, 'INVALID_CATEGORY', 'Cannot activate a service under an inactive category');
        await recordAudit(actor, kind.toUpperCase() + (input.isActive === false ? '_DEACTIVATED' : '_UPDATED'), kind, doc._id, Object.keys(input), session);
        return kind === 'Category' ? categoryDTO(doc) : serviceDTO(doc);
      });
    } catch (error) {
      if (error.code === 11000) throw new ApiError(409, 'CATALOG_EXISTS', 'This catalog name or slug already exists');
      throw error;
    }
  },
};
