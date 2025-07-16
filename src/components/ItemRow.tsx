import React from 'react';
import { Item } from '../services/ItemsService';

interface ItemRowProps {
  item: Item;
  onClick: (timestamp: number, designation: string, groupId: number) => void;
}

const ItemRow: React.FC<ItemRowProps> = React.memo(({ item, onClick }) => {
  const isOnline = item.sec < 7200; // Less than 2 hours = online
  const statusClass = isOnline ? 'status-online' : 'status-offline';
  const statusText = isOnline ? 'Online' : 'Offline';

  const handleClick = () => {
    onClick(item.updated_atposix, item.designation || 'Unknown', item.group_id || 0);
  };

  return (
    <tr className="item-clickable" onClick={handleClick}>
      <td>
        <span className="group-badge">{item.group || 'Unknown'}</span>
      </td>
      <td>
        <strong>{item.designation || 'N/A'}</strong>
      </td>
      <td>{item.brand || 'N/A'}</td>
      <td>{item.model || 'N/A'}</td>
      <td>{item.category || 'N/A'}</td>
      <td>{item.antenna || 'N/A'}</td>
      <td>{item.heure || 'N/A'}</td>
      <td>
        <span className={statusClass}>{statusText}</span>
      </td>
    </tr>
  );
});

ItemRow.displayName = 'ItemRow';

export default ItemRow;