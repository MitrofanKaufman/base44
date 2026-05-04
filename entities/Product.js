export default {
  list: (sort = '-created_date') => {
    return base44.entities.Product.list(sort);
  },
  get: (id) => {
    return base44.entities.Product.get(id);
  },
  create: (data) => {
    return base44.entities.Product.create(data);
  },
  update: (id, data) => {
    return base44.entities.Product.update(id, data);
  },
  delete: (id) => {
    return base44.entities.Product.delete(id);
  }
};