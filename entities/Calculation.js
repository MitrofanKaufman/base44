export default {
  list: (sort = '-created_date', limit = 100) => {
    return base44.entities.Calculation.list(sort, limit);
  },
  get: (id) => {
    return base44.entities.Calculation.get(id);
  },
  create: (data) => {
    return base44.entities.Calculation.create(data);
  },
  update: (id, data) => {
    return base44.entities.Calculation.update(id, data);
  },
  delete: (id) => {
    return base44.entities.Calculation.delete(id);
  }
};