import type { SimEnvironment } from '@annie3d/contracts';
import { memo } from 'react';
import { simInputs, useSimKey } from './inputs';

/**
 * Node preview for a Simulation node: a small static mock of the chosen place with the product
 * still in it (no WebGL on the canvas; the live 3D view opens in the simulator).
 */
export const SimThumb = memo(function SimThumb({
  nodeId,
  env,
  price,
}: {
  nodeId: string;
  env: SimEnvironment;
  price: string;
}) {
  useSimKey(nodeId);
  const { title, poster } = simInputs(nodeId);
  const img = poster ? <img src={poster} alt="" decoding="async" draggable={false} /> : <i className="ph" />;
  return (
    <div className={`sim-thumb sim-thumb-${env}`} data-testid="sim-thumb">
      {env === 'shop' && (
        <>
          <div className="bar">
            <b />
            <span />
            <span />
          </div>
          <div className="page">
            <div className="shot">{img}</div>
            <div className="info">
              <p className="t">{title}</p>
              <p className="stars">★★★★★</p>
              <p className="p">{price}</p>
              <span className="btn" />
            </div>
          </div>
        </>
      )}
      {env === 'tiktok' && (
        <div className="phone">
          {img}
          <div className="rail">
            <i />
            <i />
            <i />
          </div>
          <p className="cap">{title}</p>
        </div>
      )}
      {env === 'sticker' && (
        <div className="chat">
          <span className="bubble l" />
          <span className="bubble r" />
          <div className="sticker">{img}</div>
        </div>
      )}
      {env === 'showroom' && (
        <div className="room">
          <div className="spot">{img}</div>
          <span className="plinth" />
        </div>
      )}
    </div>
  );
});
