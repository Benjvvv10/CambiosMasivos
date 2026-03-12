/**
 * Modal para mostrar detalles completos de validaciones
 * Muestra tablas detalladas de errores y advertencias
 */

import React from 'react';
import styles from './ModalDetalleValidacion.module.css';

// Tipos para Jefes con clientes
interface ClienteJefe {
  codigo_cliente: string;
  razon_social: string;
  rut: string;
  comuna: string;
}

interface JefeConClientes {
  codigo_jefe: number;
  nombre_jefe: string;
  cantidad_clientes: number;
  clientes: ClienteJefe[];
}

// Tipos para Vendedores de Reemplazo
interface VendedorReemplazo {
  codigo: number;
  nombre: string;
  cargo: string;
}

// Tipos para Jefes sin Cartera (igual estructura que vendedores)
interface JefeSinCartera {
  codigo: number;
  nombre: string;
  cargo: string;
}

// Tipos para Clientes de Vendedores Eliminados
interface ClienteVendedorEliminado {
  codigo_cliente: string;
  razon_social: string;
  comuna: string;
  vendedor_eliminado: number;
  rut?: string;
}

interface ModalDetalleValidacionProps {
  isOpen: boolean;
  onClose: () => void;
  tipo: 'jefes_con_clientes' | 'vendedores_reemplazo' | 'jefes_sin_cartera' | 'otro';
  titulo: string;
  datos: any; // Se especifica según el tipo
}

export const ModalDetalleValidacion: React.FC<ModalDetalleValidacionProps> = ({
  isOpen,
  onClose,
  tipo,
  titulo,
  datos
}) => {
  if (!isOpen) return null;

  const renderJefesConClientes = (jefes: JefeConClientes[]) => {
    return (
      <div className={styles.contenedor}>
        <div className={styles.advertencia}>
          <div className={styles.advertenciaIcono}>⚠️</div>
          <div className={styles.advertenciaTexto}>
            Los Jefes de Venta no deben tener clientes asignados directamente. Reasigna estos clientes a los vendedores correspondientes.
          </div>
        </div>

        {jefes.map((jefe, index) => (
          <div key={jefe.codigo_jefe} className={styles.jefeSeccion}>
            <div className={styles.jefeHeader}>
              <h4>
                <span className={styles.jefeNombre}>{jefe.nombre_jefe}</span>
                <span className={styles.jefeCodigo}>(Código: {jefe.codigo_jefe})</span>
              </h4>
              <span className={styles.clienteCount}>
                {jefe.cantidad_clientes} cliente{jefe.cantidad_clientes !== 1 ? 's' : ''} asignado{jefe.cantidad_clientes !== 1 ? 's' : ''}
              </span>
            </div>

            <div className={styles.tablaWrapper}>
              <table className={styles.tabla}>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Razón Social</th>
                    <th>RUT</th>
                    <th>Comuna</th>
                  </tr>
                </thead>
                <tbody>
                  {jefe.clientes.map((cliente) => (
                    <tr key={cliente.codigo_cliente}>
                      <td className={styles.codigo}>{cliente.codigo_cliente}</td>
                      <td className={styles.razonSocial}>{cliente.razon_social}</td>
                      <td className={styles.rut}>{cliente.rut}</td>
                      <td>{cliente.comuna}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {index < jefes.length - 1 && <div className={styles.separador} />}
          </div>
        ))}

        <div className={styles.resumen}>
          <strong>Resumen:</strong> {jefes.length} Jefe{jefes.length !== 1 ? 's' : ''} con{' '}
          {jefes.reduce((sum, j) => sum + j.cantidad_clientes, 0)} clientes asignados en total
        </div>
      </div>
    );
  };

  const renderVendedoresReemplazo = (vendedores: VendedorReemplazo[]) => {
    return (
      <div className={styles.contenedor}>
        <div className={styles.advertencia}>
          <div className={styles.advertenciaIcono}>⚠️</div>
          <div className={styles.advertenciaTexto}>
            Los vendedores de reemplazo no necesitan tener cartera asignada. Esta situación es normal.
          </div>
        </div>

        <div className={styles.tablaWrapper}>
          <table className={styles.tabla}>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Cargo</th>
              </tr>
            </thead>
            <tbody>
              {vendedores.map((vendedor) => (
                <tr key={vendedor.codigo}>
                  <td className={styles.codigo}>{vendedor.codigo}</td>
                  <td>{vendedor.nombre}</td>
                  <td className={styles.cargo}>{vendedor.cargo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.resumen}>
          <strong>Total:</strong> {vendedores.length} vendedor{vendedores.length !== 1 ? 'es' : ''} de reemplazo sin cartera
        </div>
      </div>
    );
  };

  const renderJefesSinCartera = (jefes: JefeSinCartera[]) => {
    return (
      <div className={styles.contenedor}>
        <div className={styles.advertencia}>
          <div className={styles.advertenciaIcono}>⚠️</div>
          <div className={styles.advertenciaTexto}>
            Los Jefes de Venta no necesitan tener cartera asignada. Esta situación es normal y no requiere acción.
          </div>
        </div>

        <div className={styles.tablaWrapper}>
          <table className={styles.tabla}>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Cargo</th>
              </tr>
            </thead>
            <tbody>
              {jefes.map((jefe) => (
                <tr key={jefe.codigo}>
                  <td className={styles.codigo}>{jefe.codigo}</td>
                  <td>{jefe.nombre}</td>
                  <td className={styles.cargo}>{jefe.cargo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.resumen}>
          <strong>Total:</strong> {jefes.length} jefe{jefes.length !== 1 ? 's' : ''} de venta sin cartera
        </div>
      </div>
    );
  };

  const renderClientesVendedoresEliminados = (clientes: ClienteVendedorEliminado[]) => {
    // Agrupar clientes por vendedor eliminado
    const clientesPorVendedor = clientes.reduce((acc: any, cliente) => {
      const vendedor = cliente.vendedor_eliminado;
      if (!acc[vendedor]) {
        acc[vendedor] = [];
      }
      acc[vendedor].push(cliente);
      return acc;
    }, {});

    return (
      <div className={styles.contenedor}>
        <div className={styles.alerta}>
          <div className={styles.alertaIcono}>🚨</div>
          <div className={styles.alertaTexto}>
            Los siguientes clientes están asignados a vendedores que ya no existen en tu Estructura de Venta. 
            Debes reasignar estos clientes a vendedores activos para poder continuar.
          </div>
        </div>

        {Object.entries(clientesPorVendedor).map(([vendedor, clientesVendedor]: [string, any]) => (
          <div key={vendedor} className={styles.jefeSeccion}>
            <div className={styles.jefeHeader}>
              <h4>
                <span className={styles.jefeNombre}>Vendedor Eliminado: {vendedor}</span>
              </h4>
              <span className={styles.clienteCount}>
                {clientesVendedor.length} cliente{clientesVendedor.length !== 1 ? 's' : ''} huérfano{clientesVendedor.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className={styles.tablaWrapper}>
              <table className={styles.tabla}>
                <thead>
                  <tr>
                    <th>Código Cliente</th>
                    <th>Razón Social</th>
                    <th>Comuna</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesVendedor.map((cliente: ClienteVendedorEliminado) => (
                    <tr key={cliente.codigo_cliente}>
                      <td className={styles.codigo}>{cliente.codigo_cliente}</td>
                      <td className={styles.razonSocial}>{cliente.razon_social}</td>
                      <td>{cliente.comuna}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        <div className={styles.resumen}>
          <strong>Total:</strong> {clientes.length} cliente{clientes.length !== 1 ? 's' : ''} de vendedores eliminados
        </div>
      </div>
    );
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.titulo}>{titulo}</h3>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.contenido}>
          {tipo === 'jefes_con_clientes' && renderJefesConClientes(datos)}
          {tipo === 'vendedores_reemplazo' && renderVendedoresReemplazo(datos)}
          {tipo === 'jefes_sin_cartera' && renderJefesSinCartera(datos)}
          {tipo === 'otro' && renderOtro(datos, titulo)}
        </div>

        <div className={styles.footer}>
          <button className={styles.botonCerrar} onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
  
  // Renderizador genérico para otros tipos de validaciones
  function renderOtro(datos: any, titulo: string) {
    if (!datos || datos.length === 0) {
      return (
        <div className={styles.contenedor}>
          <p>No hay detalles disponibles.</p>
        </div>
      );
    }

    // Detectar tipo de datos y renderizar apropiadamente
    const primerElemento = datos[0];
    
    // Clientes de vendedores eliminados
    if (primerElemento && 'codigo_cliente' in primerElemento && 'vendedor_eliminado' in primerElemento && 'razon_social' in primerElemento) {
      return renderClientesVendedoresEliminados(datos);
    }
    
    // Clientes duplicados
    if (primerElemento && 'codigo_cliente' in primerElemento && 'cantidad_registros' in primerElemento && 'vendedores' in primerElemento) {
      return (
        <div className={styles.contenedor}>
          <div className={styles.alerta}>
            <div className={styles.alertaIcono}>❌</div>
            <div className={styles.alertaTexto}>
              Los siguientes clientes aparecen más de una vez en el archivo. Cada cliente debe estar registrado solo una vez.
            </div>
          </div>

          <div className={styles.tablaWrapper}>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th>Código Cliente</th>
                  <th>Razón Social</th>
                  <th>Registros</th>
                  <th>Vendedores</th>
                </tr>
              </thead>
              <tbody>
                {datos.map((item: any, index: number) => (
                  <tr key={index}>
                    <td className={styles.codigo}>{item.codigo_cliente}</td>
                    <td>{item.razon_social}</td>
                    <td style={{textAlign: 'center', fontWeight: 'bold', color: '#d32f2f'}}>{item.cantidad_registros}</td>
                    <td>{item.vendedores.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.resumen}>
            <strong>Total:</strong> {datos.length} cliente{datos.length !== 1 ? 's' : ''} duplicado{datos.length !== 1 ? 's' : ''}
          </div>
        </div>
      );
    }
    
    // Clientes faltantes del Maestro (warning)
    if (primerElemento && 'codigo_cliente' in primerElemento && 'distrito' in primerElemento && 'mensaje' in primerElemento && primerElemento.mensaje?.includes('no incluido')) {
      return (
        <div className={styles.contenedor}>
          <div className={styles.alerta}>
            <div className={styles.alertaIcono}>⚠️</div>
            <div className={styles.alertaTexto}>
              Los siguientes clientes del Maestro no están en tu archivo de cartera. Verifica que todos los clientes de tus zonas estén incluidos.
            </div>
          </div>

          <div className={styles.tablaWrapper}>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th>Código Cliente</th>
                  <th>Razón Social</th>
                  <th>Distrito</th>
                </tr>
              </thead>
              <tbody>
                {datos.map((item: any, index: number) => (
                  <tr key={index}>
                    <td className={styles.codigo}>{item.codigo_cliente}</td>
                    <td>{item.razon_social}</td>
                    <td>{item.distrito}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.resumen}>
            <strong>Total:</strong> {datos.length} cliente{datos.length !== 1 ? 's' : ''} faltante{datos.length !== 1 ? 's' : ''}
          </div>
        </div>
      );
    }
    
    // Clientes que no existen en el Maestro (error)
    if (primerElemento && 'codigo_cliente' in primerElemento && 'mensaje' in primerElemento && primerElemento.mensaje?.includes('Maestro')) {
      return (
        <div className={styles.contenedor}>
          <div className={styles.alerta}>
            <div className={styles.alertaIcono}>❌</div>
            <div className={styles.alertaTexto}>
              Los siguientes clientes no están registrados en el Maestro Cliente. Solo puedes incluir clientes que existan en el Maestro.
            </div>
          </div>

          <div className={styles.tablaWrapper}>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th>Código Cliente</th>
                  <th>Razón Social</th>
                  <th>Vendedor</th>
                </tr>
              </thead>
              <tbody>
                {datos.map((item: any, index: number) => (
                  <tr key={index}>
                    <td className={styles.codigo}>{item.codigo_cliente}</td>
                    <td>{item.razon_social}</td>
                    <td>{item.cod_vendedor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.resumen}>
            <strong>Total:</strong> {datos.length} cliente{datos.length !== 1 ? 's' : ''} no existente{datos.length !== 1 ? 's' : ''}
          </div>
        </div>
      );
    }
    
    // Vendedores faltantes de Estructura de Venta
    if (primerElemento && 'codigo' in primerElemento && 'nombre' in primerElemento && 'cargo' in primerElemento) {
      return (
        <div className={styles.contenedor}>
          <div className={styles.alerta}>
            <div className={styles.alertaIcono}>❌</div>
            <div className={styles.alertaTexto}>
              Los siguientes vendedores están en tu Estructura de Venta pero no tienen clientes asignados. Todos los vendedores activos (excepto reemplazos y jefes) deben tener al menos un cliente.
            </div>
          </div>

          <div className={styles.tablaWrapper}>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Cargo</th>
                </tr>
              </thead>
              <tbody>
                {datos.map((item: any) => (
                  <tr key={item.codigo}>
                    <td className={styles.codigo}>{item.codigo}</td>
                    <td>{item.nombre}</td>
                    <td className={styles.cargo}>{item.cargo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.resumen}>
            <strong>Total:</strong> {datos.length} vendedor{datos.length !== 1 ? 'es' : ''} sin cartera
          </div>
        </div>
      );
    }
    
    // Registros con campos obligatorios faltantes (CodVend o CodCliente)
    if (primerElemento && 'fila' in primerElemento && 'mensaje' in primerElemento) {
      const tieneCodVendedor = 'codigo_vendedor' in primerElemento;
      const tieneCodCliente = 'codigo_cliente' in primerElemento;
      
      return (
        <div className={styles.contenedor}>
          <div className={styles.alerta}>
            <div className={styles.alertaIcono}>❌</div>
            <div className={styles.alertaTexto}>
              Los siguientes registros tienen campos obligatorios sin completar. Agrega la información faltante en tu archivo.
            </div>
          </div>

          <div className={styles.tablaWrapper}>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th>Fila</th>
                  {tieneCodCliente && <th>Código Cliente</th>}
                  {tieneCodVendedor && <th>Código Vendedor</th>}
                  <th>Razón Social</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {datos.map((item: any, index: number) => (
                  <tr key={index}>
                    <td style={{textAlign: 'center'}}>{item.fila}</td>
                    {tieneCodCliente && <td className={styles.codigo}>{item.codigo_cliente || 'N/A'}</td>}
                    {tieneCodVendedor && <td className={styles.codigo}>{item.codigo_vendedor || 'N/A'}</td>}
                    <td>{item.razon_social}</td>
                    <td style={{color: '#d32f2f'}}>{item.mensaje}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.resumen}>
            <strong>Total:</strong> {datos.length} registro{datos.length !== 1 ? 's' : ''} con error{datos.length !== 1 ? 'es' : ''}
          </div>
        </div>
      );
    }

    // Fallback: mostrar JSON
    return (
      <div className={styles.contenedor}>
        <pre className={styles.detallePre}>{JSON.stringify(datos, null, 2)}</pre>
      </div>
    );
  }
};

