export default {
  list: (sort = '-created_date') => {
    return base44.entities.Client.list(sort);
  },
  get: (id) => {
    return base44.entities.Client.get(id);
  },
  create: (data) => {
    return base44.entities.Client.create(data);
  },
  update: (id, data) => {
    return base44.entities.Client.update(id, data);
  },
  delete: (id) => {
    return base44.entities.Client.delete(id);
  }
};