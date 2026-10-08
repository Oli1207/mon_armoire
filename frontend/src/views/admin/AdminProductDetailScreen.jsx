import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminAPI } from '../../utils/api';

export default function AdminProductDetailScreen() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [newVariant, setNewVariant] = useState({ color: '', size: '', material: '', price: '', stock: '' });
  const [uploading, setUploading] = useState(false);

  const load = () => {
    adminAPI.productDetail(id).then(({ data }) => setProduct(data));
  };

  useEffect(load, [id]);

  const handleFieldSave = async (field, value) => {
    await adminAPI.updateProduct(id, { [field]: value });
    load();
  };

  const handleAddVariant = async () => {
    await adminAPI.createVariant(id, {
      ...newVariant,
      price: newVariant.price || 0,
      stock: newVariant.stock || 0,
    });
    setNewVariant({ color: '', size: '', material: '', price: '', stock: '' });
    load();
  };

  const handleVariantChange = async (variantId, field, value) => {
    await adminAPI.updateVariant(variantId, { [field]: value });
    load();
  };

  const handleDeleteVariant = async (variantId) => {
    if (!window.confirm('Supprimer cette variante ? Cette action est irréversible.')) return;
    await adminAPI.deleteVariant(variantId);
    load();
  };

  const handleUploadImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('image', file);
    formData.append('is_main', product.images.length === 0 ? 'true' : 'false');
    try {
      await adminAPI.createImage(id, formData);
      load();
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (imageId) => {
    await adminAPI.deleteImage(imageId);
    load();
  };

  if (!product) return <p>Chargement...</p>;

  return (
    <div>
      <Link to="/admin/produits" className="d-block mb-3">← Retour aux produits</Link>
      <h1 className="h4 mb-4">{product.name}</h1>

      <div className="row g-4">
        <div className="col-md-6">
          <h6>Informations</h6>
          <label className="form-label small">Nom</label>
          <input
            className="form-control mb-2"
            defaultValue={product.name}
            onBlur={(e) => handleFieldSave('name', e.target.value)}
          />
          <label className="form-label small">Description</label>
          <textarea
            className="form-control mb-2"
            defaultValue={product.description}
            onBlur={(e) => handleFieldSave('description', e.target.value)}
          />
          <label className="form-label small">Signification symbolique</label>
          <textarea
            className="form-control mb-2"
            defaultValue={product.symbolic_meaning}
            onBlur={(e) => handleFieldSave('symbolic_meaning', e.target.value)}
          />
          <div className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              checked={product.is_new}
              onChange={(e) => handleFieldSave('is_new', e.target.checked)}
            />
            <label className="form-check-label">Nouveauté</label>
          </div>
          <div className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              checked={product.is_personalizable}
              onChange={(e) => handleFieldSave('is_personalizable', e.target.checked)}
            />
            <label className="form-check-label">Personnalisable (gravure)</label>
          </div>
        </div>

        <div className="col-md-6">
          <h6>Images</h6>
          <div className="d-flex flex-wrap gap-2 mb-2">
            {product.images.map((img) => (
              <div key={img.id} className="position-relative">
                <img src={img.image} alt="" style={{ width: 80, height: 80, objectFit: 'cover' }} className="rounded" />
                <button
                  className="btn btn-sm btn-danger position-absolute top-0 end-0 p-0"
                  style={{ width: 20, height: 20, lineHeight: '10px' }}
                  onClick={() => handleDeleteImage(img.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <input type="file" accept="image/*" onChange={handleUploadImage} disabled={uploading} />
        </div>

        <div className="col-12">
          <h6>Variantes</h6>
          <table className="table table-sm bg-white">
            <thead>
              <tr>
                <th>Couleur</th>
                <th>Taille</th>
                <th>Matériau</th>
                <th>Prix</th>
                <th>Stock</th>
                <th>Défaut</th>
                <th>Précommande</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {product.variants.map((v) => (
                <tr key={v.id}>
                  <td><input className="form-control form-control-sm" defaultValue={v.color} onBlur={(e) => handleVariantChange(v.id, 'color', e.target.value)} /></td>
                  <td><input className="form-control form-control-sm" defaultValue={v.size} onBlur={(e) => handleVariantChange(v.id, 'size', e.target.value)} /></td>
                  <td><input className="form-control form-control-sm" defaultValue={v.material} onBlur={(e) => handleVariantChange(v.id, 'material', e.target.value)} /></td>
                  <td><input type="number" className="form-control form-control-sm" defaultValue={v.price} onBlur={(e) => handleVariantChange(v.id, 'price', e.target.value)} style={{ width: 100 }} /></td>
                  <td><input type="number" className="form-control form-control-sm" defaultValue={v.stock} onBlur={(e) => handleVariantChange(v.id, 'stock', e.target.value)} style={{ width: 80 }} /></td>
                  <td>
                    <input type="checkbox" checked={v.is_default} onChange={(e) => handleVariantChange(v.id, 'is_default', e.target.checked)} />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={v.allow_preorder}
                      onChange={(e) => handleVariantChange(v.id, 'allow_preorder', e.target.checked)}
                      title="Autoriser la précommande en rupture de stock"
                    />
                    {v.allow_preorder && (
                      <input
                        className="form-control form-control-sm mt-1"
                        placeholder="Note (ex : retour mi-déc.)"
                        defaultValue={v.restock_note}
                        onBlur={(e) => handleVariantChange(v.id, 'restock_note', e.target.value)}
                        style={{ width: 150 }}
                      />
                    )}
                  </td>
                  <td>
                    <button className="btn btn-sm btn-link text-danger" onClick={() => handleDeleteVariant(v.id)}>Supprimer</button>
                  </td>
                </tr>
              ))}
              <tr>
                <td><input className="form-control form-control-sm" placeholder="Couleur" value={newVariant.color} onChange={(e) => setNewVariant({ ...newVariant, color: e.target.value })} /></td>
                <td><input className="form-control form-control-sm" placeholder="Taille" value={newVariant.size} onChange={(e) => setNewVariant({ ...newVariant, size: e.target.value })} /></td>
                <td><input className="form-control form-control-sm" placeholder="Matériau" value={newVariant.material} onChange={(e) => setNewVariant({ ...newVariant, material: e.target.value })} /></td>
                <td><input type="number" className="form-control form-control-sm" placeholder="Prix" value={newVariant.price} onChange={(e) => setNewVariant({ ...newVariant, price: e.target.value })} style={{ width: 100 }} /></td>
                <td><input type="number" className="form-control form-control-sm" placeholder="Stock" value={newVariant.stock} onChange={(e) => setNewVariant({ ...newVariant, stock: e.target.value })} style={{ width: 80 }} /></td>
                <td></td>
                <td></td>
                <td><button className="btn btn-sm btn-primary" onClick={handleAddVariant}>Ajouter</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
