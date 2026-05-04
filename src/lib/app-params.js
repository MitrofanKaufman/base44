export function getAppParams() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    product_id: urlParams.get('product_id'),
    project_id: urlParams.get('project_id'),
    client_id: urlParams.get('client_id'),
    calculation_id: urlParams.get('calculation_id'),
  };
}