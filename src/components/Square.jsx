export default function Square({ 
  isWhite,
  position, 
  piece, 
  squareId, 
  setClickedSquare, 
  clickedSquare, 
  sethoveredSquare, 
  hoveredSquare, 
  onSquareClick, 
  moveType, 
  isCheck,
  onDragStart, 
  onDrop,
  isLastMove,
}) {
  const { row, col } = position;
  const columnNumber = 8 - row;
  const isSelected = clickedSquare === squareId;
  const isHovered = hoveredSquare === squareId;

  const handleDragStart = (e) => {
    if (piece) {
      // Set a ghost image or data if needed, but primarily trigger your logic
      onDragStart(squareId);
    }
  };

  const handleDrop = (e) => {
    // e.preventDefault() is required to allow the drop to finish
    e.preventDefault();
    onDrop(squareId);
  };

  return (
    <div 
      className={`square relative
          ${col == 0 && !isSelected && !isHovered ? 'border-l-[0.1px] border-white/20' : ''}
          ${col == 7 && !isSelected && !isHovered ? 'border-r-[0.1px] border-white/20' : ''}
          ${row == 7 && !isSelected && !isHovered ? 'border-b-[0.1px] border-white/20' : ''}
          ${row == 0 && !isSelected && !isHovered ? 'border-t-[0.1px] border-white/20' : ''}
          ${isSelected ? 'border-[0.1px] border-white' : ''}
          ${isHovered && piece !== null ? 'border-[0.1px] border-white' : ''}
      `}
      style={{
        backgroundColor: isWhite ? '#697283' : '#2d313f',
        width: '70px', height: '70px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={() => onSquareClick(squareId)}
      onMouseEnter={() => sethoveredSquare(squareId)}
      onMouseLeave={() => sethoveredSquare(null)}
      // --- ADDED DRAG EVENTS ---
      onDragOver={(e) => e.preventDefault()} // CRITICAL: Tells the browser this is a drop zone
      onDrop={handleDrop}                    // Triggers move execution
    >

      {isLastMove && (
        <div className="absolute inset-0 bg-yellow-200/30 pointer-events-none z-0" />
      )}
      {/* GLOW BEHIND PIECE */}
      {isCheck && (
        <div className="absolute inset-0 z-0 opacity-80"
          style={{ background: 'radial-gradient(circle, rgba(255,0,0,0.6) 0%, rgba(255,0,0,0) 70%)', borderRadius: '50%' }}
        />
      )}

      {/* LABELS */}
      {row == 7 && <p className='absolute bottom-1 right-0 w-4 h-4 flex justify-center items-center pointer-events-none'>
        <span className={`font-bold opacity-75 ${isWhite ? 'text-[#2d313f]' : 'text-[#697283]'}`}>
          {String.fromCharCode(97 + col)}
        </span>
      </p>}
      {col == 0 && <p className='absolute top-1 left-0 w-4 h-4 flex justify-center items-center pointer-events-none'>
        <span className={`font-bold opacity-75 ${isWhite ? 'text-[#2d313f]' : 'text-[#697283]'}`}>
          {columnNumber}
        </span>
      </p>}

      {piece && (
        <img 
          src={`/chess_pieces/${piece}.png`}
          draggable="true"
          onDragStart={handleDragStart}
          className="cursor-grab active:cursor-grabbing w-[4rem] h-[4rem] z-10"
          alt={piece}
        />
      )}
      
      {/* MOVE INDICATORS */}
      {moveType === 'quiet' && <div className="absolute w-6 h-6 rounded-full bg-black/15 z-20 pointer-events-none" />}
      {moveType === 'capture' && <div className="absolute w-[62px] h-[62px] rounded-full border-[6px] border-black/15 z-20 pointer-events-none" />}
    </div>
  );
}