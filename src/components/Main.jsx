import { useEffect, useRef, useState } from "react";
import Square from "./Square";
import { Chess } from "chess.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyBr6ya1XZxOn6vWAmMNziAieRQ_gbaeaqY";
const genAI = new GoogleGenerativeAI(API_KEY);

// --- 1. MODEL CONFIGURATION ---
const MODEL_LIST = [
  "gemma-3-12b-it",         // Primary: High quality open model
  "gemini-2.5-flash",       // Fallback 1: Stable
  "gemini-2.5-flash-lite",  // Fallback 2: Fast
  "gemini-1.5-flash"        // Fallback 3: Backup
];

// --- CUSTOM LOADER ---
const GeminiLogo = () => (
  <svg viewBox="0 0 256 256" className="w-full h-full">
    <g transform="translate(1.4 1.4) scale(2.81 2.81)">
      <linearGradient id="logoGrad" gradientUnits="userSpaceOnUse" x1="60" y1="33" x2="35" y2="53">
        <stop offset="0%" style={{ stopColor: 'rgb(145,104,192)' }} />
        <stop offset="34%" style={{ stopColor: 'rgb(86,132,209)' }} />
        <stop offset="67%" style={{ stopColor: 'rgb(27,161,227)' }} />
      </linearGradient>
      <path d="M 90 45.09 C 65.838 46.573 46.573 65.838 45.09 90 h -0.18 C 43.43 65.837 24.163 46.57 0 45.09 v -0.18 C 24.163 43.43 43.43 24.163 44.91 0 h 0.18 C 46.573 24.162 65.838 43.427 90 44.91 V 45.09 z" style={{ fill: 'url(#logoGrad)' }} />
    </g>
  </svg>
);

const ThinkingLoader = () => (
  <div className="relative w-12 h-12 flex-shrink-0 flex items-center justify-center ml-2">
    <div className="absolute w-5 h-5 z-20"><GeminiLogo /></div>
    <div className="absolute inset-0 z-10">
      <style>
        {`
          .loader-svg { width: 100%; height: 100%; transform-origin: center; animation: rotate4 2s linear infinite; }
          .loader-circle { fill: none; stroke: url(#loaderGradient); stroke-width: 3; stroke-dasharray: 1, 200; stroke-dashoffset: 0; stroke-linecap: round; animation: dash4 1.5s ease-in-out infinite; }
          @keyframes rotate4 { 100% { transform: rotate(360deg); } }
          @keyframes dash4 { 0% { stroke-dasharray: 1, 200; stroke-dashoffset: 0; } 50% { stroke-dasharray: 90, 200; stroke-dashoffset: -35px; } 100% { stroke-dashoffset: -125px; } }
        `}
      </style>
      <svg className="loader-svg" viewBox="25 25 50 50">
        <defs>
          <linearGradient id="loaderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#9168c0" />
            <stop offset="50%" stopColor="#5684d1" />
            <stop offset="100%" stopColor="#1ba1e3" />
          </linearGradient>
        </defs>
        <circle className="loader-circle" r="20" cy="50" cx="50"></circle>
      </svg>
    </div>
  </div>
);

// --- ARROW COMPONENT ---
const ArrowOverlay = ({ arrows, orientation }) => {
  if (!arrows || arrows.length === 0) return null;
  const getCoords = (square) => {
    if (!square) return { x: 0, y: 0 };
    const col = square.charCodeAt(0) - 97; 
    const row = 8 - parseInt(square[1]);
    const x = (orientation === 'w' ? col : 7 - col) * 12.5 + 6.25;
    const y = (orientation === 'w' ? row : 7 - row) * 12.5 + 6.25;
    return { x, y };
  };
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-30 overflow-visible" viewBox="0 0 100 100">
      <defs>
        <marker id="arrow-user" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
          <path d="M0,0 L4,2 L0,4 Z" fill="#fb923c" />
        </marker>
        <linearGradient id="liquidGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#9168c0"><animate attributeName="stop-color" values="#9168c0; #5684d1; #1ba1e3; #9168c0" dur="2s" repeatCount="indefinite" /></stop>
          <stop offset="100%" stopColor="#1ba1e3"><animate attributeName="stop-color" values="#1ba1e3; #9168c0; #5684d1; #1ba1e3" dur="2s" repeatCount="indefinite" /></stop>
        </linearGradient>
        <marker id="arrow-gm" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
          <path d="M0,0 L4,2 L0,4 Z" fill="url(#liquidGrad)" />
        </marker>
      </defs>
      {arrows.map((arrow, i) => {
        const start = getCoords(arrow.from);
        const end = getCoords(arrow.to);
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const shorten = 2.5; 
        const endX = end.x - (dx / len) * shorten;
        const endY = end.y - (dy / len) * shorten;
        const isGM = arrow.type === 'gm';
        return (
          <line 
            key={i} x1={start.x} y1={start.y} x2={endX} y2={endY}
            stroke={isGM ? "url(#liquidGrad)" : "#fb923c"}
            strokeWidth="1.8" 
            markerEnd={isGM ? "url(#arrow-gm)" : "url(#arrow-user)"}
            opacity="0.9" strokeLinecap="butt"
          />
        );
      })}
    </svg>
  );
};

export default function Main() {
  const chessGameRef = useRef(new Chess());
  const engineRef = useRef(null);
  
  const historyScrollRef = useRef(null);
  const chatScrollRef = useRef(null);

  const [board, setBoard] = useState(chessGameRef.current.board());
  const [possibleMoves, setpossibleMoves] = useState([]);
  const [clickedSquare, setClickedSquare] = useState(null);
  const [draggedSquare, setDraggedSquare] = useState(null);
  const [turn, setTurn] = useState('w');
  const [history, setHistory] = useState([]);
  const [fenHistory, setFenHistory] = useState([chessGameRef.current.fen()]);
  const [viewIndex, setViewIndex] = useState(-1);

  const [gameOver, setGameOver] = useState(null);
  const [checkSquare, setCheckSquare] = useState(null);
  const [pendingPromotion, setPendingPromotion] = useState(null);
  const [hoveredSquare, sethoveredSquare] = useState(null);
  const [lastMove, setLastMove] = useState(null); 

  const [gameStarted, setGameStarted] = useState(false);
  const [playerColor, setPlayerColor] = useState('w'); 
  const [orientation, setOrientation] = useState('w');
  
  // Evaluation: 0 = Equal, +100 = White +1 Pawn, 10000 = White Mate
  const [evaluation, setEvaluation] = useState(0); 
  const [isMateEval, setIsMateEval] = useState(false); // New state to track if it's a mate score

  const [botElo, setBotElo] = useState(250);
  const [bestMoveHint, setBestMoveHint] = useState(null); 

  const [rightClickStart, setRightClickStart] = useState(null);
  const [arrows, setArrows] = useState([]); 

  const [userInput, setUserInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', text: "I'm Gemini. Select your side and level on the right to begin!" }
  ]);

  const isGameInProgress = history.length > 0 && !gameOver;

  // --- LOGIC ---

  const playSound = (soundName) => {
    const ext = soundName === 'game-end' ? 'webm' : 'mp3';
    new Audio(`/sounds/${soundName}.${ext}`).play().catch(() => {});
  };

  const handleMoveSounds = (move) => {
    if (chessGameRef.current.isGameOver()) playSound('game-end');
    else if (chessGameRef.current.inCheck()) playSound('move-check');
    else if (move.captured) playSound('capture');
    else if (move.flags.includes('k') || move.flags.includes('q')) playSound('castle');
    else if (move.promotion) playSound('promote');
    else playSound(move.color === playerColor ? 'move' : 'move-opponent');
  };

  const updateGameStatus = () => {
    const chessgame = chessGameRef.current;
    setHistory(chessgame.history({ verbose: true }));
    setFenHistory(prev => [...prev, chessgame.fen()]);
    setViewIndex(-1);

    if (chessgame.isGameOver()) {
      setGameOver(chessgame.isCheckmate() ? `Checkmate! ${chessgame.turn() === 'w' ? 'Black' : 'White'} wins.` : 'Game Over');
    } else if (chessgame.inCheck()) {
      chessgame.board().forEach((row, rIdx) => {
        row.forEach((cell, cIdx) => {
          if (cell && cell.type === 'k' && cell.color === chessgame.turn()) setCheckSquare(`${rIdx}-${cIdx}`);
        });
      });
    } else { setCheckSquare(null); }
  };

  const handleMoveUpdates = (move) => {
    setBoard(chessGameRef.current.board());
    setTurn(chessGameRef.current.turn());
    setLastMove({ from: move.from, to: move.to });
    handleMoveSounds(move);
    setArrows([]); 
    updateGameStatus();
  };

  const makeBotMove = (from, to, promotion) => {
    const move = chessGameRef.current.move({ from, to, promotion });
    if (move) handleMoveUpdates(move);
  };

  const idToNotation = (id) => {
    if (!id) return null;
    const [row, col] = id.split('-').map(Number);
    return `${String.fromCharCode(97 + col)}${8 - row}`;
  };

  const executeMove = (fromId, toId) => {
    const from = idToNotation(fromId);
    const to = idToNotation(toId);
    const moves = chessGameRef.current.moves({ square: from, verbose: true });
    if (moves.some(m => m.to === to && m.promotion)) { setPendingPromotion({ from, to }); return; }
    
    const move = chessGameRef.current.move({ from, to, promotion: "q" });
    if (move) {
      setBoard(chessGameRef.current.board()); setpossibleMoves([]); setClickedSquare(null); setDraggedSquare(null);
      setTurn(chessGameRef.current.turn()); 
      setLastMove({ from: move.from, to: move.to });
      handleMoveSounds(move); 
      setArrows([]); updateGameStatus();
    } else playSound('illegal');
  };

  const onSquareClick = (id) => {
    if (viewIndex !== -1) return;
    if (!gameStarted || gameOver || chessGameRef.current.turn() !== playerColor) return;
    if (clickedSquare && possibleMoves.some(m => m.id === id)) { executeMove(clickedSquare, id); return; }
    const rawMoves = chessGameRef.current.moves({ square: idToNotation(id), verbose: true });
    if (rawMoves.length > 0) {
      setpossibleMoves(rawMoves.map(m => ({ id: `${8 - parseInt(m.to[1])}-${m.to.charCodeAt(0) - 97}`, isCapture: m.flags.includes('c') || m.flags.includes('e') })));
      setClickedSquare(id);
    } else { setpossibleMoves([]); setClickedSquare(null); }
  };

  const handleDragStart = (id) => {
    if (viewIndex !== -1) return;
    if (!gameStarted || gameOver || chessGameRef.current.turn() !== playerColor) return;
    onSquareClick(id); setDraggedSquare(id);
  };
  
  const handleDrop = (targetId) => {
    if (gameOver || !draggedSquare) return;
    onSquareClick(targetId); setDraggedSquare(null);
  };

  const handlePromotion = (pieceType) => {
    const move = chessGameRef.current.move({ from: pendingPromotion.from, to: pendingPromotion.to, promotion: pieceType });
    if (move) { 
        setBoard(chessGameRef.current.board()); setPendingPromotion(null); setTurn(chessGameRef.current.turn()); 
        setpossibleMoves([]); setClickedSquare(null); 
        setLastMove({ from: move.from, to: move.to }); 
        handleMoveSounds(move); setArrows([]); updateGameStatus(); 
    }
  };

  const resetGame = () => {
    chessGameRef.current.reset();
    setBoard(chessGameRef.current.board());
    setTurn('w');
    setCheckSquare(null);
    setGameOver(null);
    setpossibleMoves([]);
    setClickedSquare(null);
    setHistory([]);
    setFenHistory([chessGameRef.current.fen()]);
    setViewIndex(-1);
    setEvaluation(0);
    setIsMateEval(false); // Reset mate state
    setGameStarted(false);
    setArrows([]);
    setLastMove(null);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || isTyping) return;

    const userText = userInput;
    setChatMessages(prev => [...prev, { role: 'user', text: userText }]);
    setUserInput("");
    setIsTyping(true);
    setArrows(prev => prev.filter(a => a.type !== 'gm')); 

    const currentFEN = chessGameRef.current.fen();
    // Format Eval for text: if Mate, say "Mate in X", else "0.5"
    const displayEval = isMateEval 
        ? `Mate in ${Math.abs(10000 - Math.abs(evaluation))}` 
        : (evaluation / 100).toFixed(1);
    
    const side = playerColor === 'w' ? "White" : "Black";
    const hintMove = bestMoveHint ? `${bestMoveHint.from} to ${bestMoveHint.to}` : "calculating";

    const prompt = `Act as a Chess Teacher. FEN: ${currentFEN}. Eval: ${displayEval}. Player: ${side}. Best Move: ${hintMove}. User: "${userText}". Keep it very short (2 sentences max). No markdown.`;

    let success = false;
    for (const modelName of MODEL_LIST) {
      if (success) break;
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const text = await result.response.text();
        setChatMessages(prev => [...prev, { role: 'ai', text: text }]);
        if (bestMoveHint) setArrows(prev => [...prev, { from: bestMoveHint.from, to: bestMoveHint.to, type: 'gm' }]);
        success = true;
      } catch (error) { console.warn(`Model ${modelName} failed...`); }
    }
    if (!success) setChatMessages(prev => [...prev, { role: 'ai', text: "Systems busy. Please try again." }]);
    setIsTyping(false);
  };

  const goBack = () => { setViewIndex((prev) => { playSound('move'); if (prev === -1) return Math.max(0, history.length - 1); return Math.max(0, prev - 1); }); };
  const goForward = () => { setViewIndex((prev) => { playSound('move'); if (prev === -1 || prev >= history.length - 1) return -1; return prev + 1; }); };

  // --- EFFECTS ---
  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === "ArrowLeft") goBack(); if (e.key === "ArrowRight") goForward(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [history.length]);

  useEffect(() => { if (historyScrollRef.current) historyScrollRef.current.scrollTop = historyScrollRef.current.scrollHeight; }, [history]);
  useEffect(() => { if (chatScrollRef.current) chatScrollRef.current.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" }); }, [chatMessages, isTyping]);

  useEffect(() => {
    const engine = new Worker("/stockfish.js");
    engineRef.current = engine;
    engine.onmessage = (e) => {
      const line = e.data;
      
      // PARSE CP SCORE
      if (line.includes("score cp") && gameStarted) {
        const parts = line.split(" ");
        const score = parseInt(parts[parts.indexOf("cp") + 1]);
        const sideMultiplier = chessGameRef.current.turn() === 'w' ? 1 : -1;
        setEvaluation(score * sideMultiplier);
        setIsMateEval(false);
      }
      // PARSE MATE SCORE
      else if (line.includes("score mate") && gameStarted) {
        const parts = line.split(" ");
        const mateIn = parseInt(parts[parts.indexOf("mate") + 1]);
        const sideMultiplier = chessGameRef.current.turn() === 'w' ? 1 : -1;
        // Store extreme value for bar (e.g. 10000) but keep 'mateIn' for text
        const score = (mateIn > 0 ? 10000 - mateIn : -10000 - mateIn) * sideMultiplier;
        setEvaluation(score);
        setIsMateEval(true);
      }

      if (line.startsWith("bestmove")) {
        const moveStr = line.split(" ")[1];
        if (moveStr !== "(none)") {
          const from = moveStr.substring(0, 2);
          const to = moveStr.substring(2, 4);
          setBestMoveHint({ from, to }); 
          if (gameStarted && !gameOver && chessGameRef.current.turn() !== playerColor) {
            const promotion = moveStr.length === 5 ? moveStr[4] : "q";
            makeBotMove(from, to, promotion);
          }
        }
      }
    };
    engine.postMessage("uci");
    return () => engine.terminate();
  }, [playerColor, gameStarted, gameOver]);

  useEffect(() => {
    if (!gameStarted || gameOver || !engineRef.current) return;
    const fen = chessGameRef.current.fen(); 
    if (chessGameRef.current.turn() !== playerColor) {
      const skillLevel = Math.max(0, Math.floor(((botElo - 250) / 3000) * 20));
      engineRef.current.postMessage(`setoption name Skill Level value ${skillLevel}`);
      engineRef.current.postMessage(`position fen ${fen}`);
      engineRef.current.postMessage(`go movetime 1000`); 
    } else {
      engineRef.current.postMessage(`position fen ${fen}`);
      engineRef.current.postMessage("go depth 12");
    }
  }, [turn, gameOver, botElo, gameStarted]);

  // --- RENDER ---
  
  // SIGMOID BAR CALCULATION
  const getWhiteBarHeight = () => {
    if (!gameStarted) return 50;
    // Standard Sigmoid: 1 / (1 + e^-k*x). k=0.004 is a good chess constant
    const evalClamped = Math.max(-10000, Math.min(10000, evaluation));
    // Determine Winning Chance (0 to 1)
    // Positive evaluation (White advantage) -> > 50%
    const winningChance = 1 / (1 + Math.exp(-0.004 * evalClamped));
    
    // Clamp visual range between 5% and 95% so bar never fully disappears
    return Math.min(Math.max(winningChance * 100, 5), 95);
  };

  let displayBoard = board;
  let displayLastMove = lastMove;
  if (viewIndex !== -1 && fenHistory[viewIndex + 1]) {
      const tempGame = new Chess(fenHistory[viewIndex + 1]);
      displayBoard = tempGame.board();
      const histMove = history[viewIndex];
      displayLastMove = histMove ? { from: histMove.from, to: histMove.to } : null;
  }

  const rowIndices = orientation === 'w' ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];
  const colIndices = orientation === 'w' ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];

  return (
    <div className="flex flex-wrap min-h-screen w-full bg-[#161512] p-2 md:p-4 gap-4 text-white justify-center items-center overflow-x-hidden overflow-y-auto font-sans" onContextMenu={(e) => e.preventDefault()}>
      
      {/* LEFT: COACH */}
      <div className="flex flex-col w-full md:w-[320px] h-[560px] bg-[#262421] rounded border border-white/5 order-3 md:order-1">
        <div className="p-3 bg-[#21201d] text-center font-bold text-xs uppercase tracking-widest text-gray-400 border-b border-white/5">GEMINI COACH</div>
        <div ref={chatScrollRef} className="flex-grow p-5 overflow-y-auto flex flex-col gap-6 custom-scrollbar">
          {chatMessages.map((msg, i) => (
            <div key={i} className={`flex gap-3 items-start ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'ai' && (i === chatMessages.length - 1 && isTyping ? null : <div className="w-5 h-5"><GeminiLogo /></div>)}
              <div className={`text-sm leading-relaxed ${msg.role === 'user' ? 'text-[#81b64c] font-bold text-right' : 'text-gray-200'}`}>{msg.text}</div>
            </div>
          ))}
          {isTyping && <div className="flex gap-3 items-center animate-in fade-in"><ThinkingLoader /></div>}
        </div>
        <form onSubmit={handleSendMessage} className="p-4 bg-[#21201d] border-t border-white/5 flex flex-col gap-2">
          <textarea value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="Ask strategy..." className="w-full bg-transparent text-sm p-0 outline-none border-none resize-none h-10 placeholder-gray-600" />
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-gray-500 font-bold uppercase">Right-click board to draw</span>
            <button type="submit" disabled={isTyping} className="px-4 py-1 rounded text-xs font-bold bg-[#312e2b] hover:bg-white hover:text-black transition-all">Ask</button>
          </div>
        </form>
      </div>

      {/* CENTER: BOARD + ARROWS + EVAL BAR */}
      <div className={`flex gap-1 items-center order-1 md:order-2 ${orientation === 'b' ? 'flex-row-reverse' : ''}`}>
        
        {/* EVALUATION BAR */}
        <div className="w-6 md:w-8 h-[560px] bg-[#161512] rounded relative overflow-hidden border border-white/5 flex flex-col shadow-inner">
          <div className="flex-grow bg-[#161512]"></div>
          {/* Animated White Bar Height */}
          <div className="bg-white transition-all duration-700 ease-out" style={{ height: `${getWhiteBarHeight()}%` }}></div>
          {/* Eval Text Overlay */}
          {gameStarted && (
            <span className="absolute top-1/2 -translate-y-1/2 w-full text-center text-[10px] md:text-xs font-bold opacity-80 mix-blend-difference text-white select-none z-10">
              {isMateEval 
                ? `M${Math.abs(10000 - Math.abs(evaluation))}` 
                : Math.abs(evaluation / 100).toFixed(1)
              }
            </span>
          )}
        </div>
        
        <div className="chess-board relative shadow-2xl scale-[0.6] sm:scale-[0.85] md:scale-100 origin-center transition-all select-none" onContextMenu={e => e.preventDefault()}>
          <ArrowOverlay arrows={arrows} orientation={orientation} />
          {rowIndices.map((rIdx) => (
            <div key={rIdx} className="flex">
              {colIndices.map((cIdx) => {
                const squareId = `${rIdx}-${cIdx}`;
                const pieceData = displayBoard[rIdx][cIdx];
                const moveData = possibleMoves?.find(m => m.id === squareId);
                const currentNotation = `${String.fromCharCode(97 + cIdx)}${8 - rIdx}`;
                const isLastMove = displayLastMove && (displayLastMove.from === currentNotation || displayLastMove.to === currentNotation);

                return (
                  <div key={squareId} onMouseDown={(e) => handleRightClickDown(squareId, e)} onMouseUp={(e) => handleRightClickUp(squareId, e)}>
                    <Square 
                      isLastMove={isLastMove}
                      squareId={squareId} position={{ row: rIdx, col: cIdx }} 
                      isWhite={(rIdx + cIdx) % 2 === 0} 
                      piece={pieceData ? `${pieceData.color}${pieceData.type}` : null} 
                      isCheck={checkSquare === squareId && viewIndex === -1} 
                      moveType={viewIndex === -1 ? (moveData ? (moveData.isCapture ? 'capture' : 'quiet') : null) : null} 
                      onSquareClick={onSquareClick} onDragStart={handleDragStart} onDrop={handleDrop} 
                      clickedSquare={clickedSquare} setClickedSquare={setClickedSquare} 
                      hoveredSquare={hoveredSquare} sethoveredSquare={sethoveredSquare} 
                    />
                  </div>
                );
              })}
            </div>
          ))}
          {pendingPromotion && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="bg-[#2d313f] p-4 rounded-lg flex gap-4 border border-white/20">
                {['q', 'r', 'b', 'n'].map(t => (
                  <button key={t} onClick={() => handlePromotion(t)} className="hover:bg-white/10 p-2 rounded"><img src={`/chess_pieces/${playerColor}${t}.png`} className="w-14 h-14" /></button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: INFO */}
      <div className="flex flex-col w-full md:w-[320px] h-[560px] bg-[#262421] rounded shadow-lg overflow-hidden border border-white/5 order-2 md:order-3">
        <div className="p-3 bg-[#21201d] text-center font-bold text-xs uppercase text-gray-400 border-b border-white/5 flex justify-between items-center px-4">
          <span>📊 Game Info</span>
          <div className="flex gap-1">
            <button onClick={goBack} className="bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-[9px] border border-white/10 text-white">◀</button>
            <button onClick={goForward} className="bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-[9px] border border-white/10 text-white">▶</button>
            <button onClick={() => setOrientation(prev => prev === 'w' ? 'b' : 'w')} className="bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-[9px] border border-white/10 ml-2">Rotate</button>
          </div>
        </div>

        {!gameStarted && (
          <div className="p-4 bg-[#2d313f]/50 border-b border-white/5 flex flex-col gap-4 animate-in slide-in-from-right">
            <div><p className="text-[10px] uppercase text-gray-500 font-bold mb-2">Choose Side</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => {setPlayerColor('w'); setOrientation('w')}} className={`py-2 rounded text-xs font-bold transition-all ${playerColor === 'w' ? 'bg-white text-black' : 'bg-white/10 text-gray-400'}`}>White</button>
                <button onClick={() => {setPlayerColor('b'); setOrientation('b')}} className={`py-2 rounded text-xs font-bold transition-all ${playerColor === 'b' ? 'bg-white text-black' : 'bg-white/10 text-gray-400'}`}>Black</button>
              </div>
            </div>
            <button onClick={() => { playSound('game-start'); setGameStarted(true); }} className="w-full py-3 bg-[#81b64c] hover:bg-[#a3d160] text-white font-bold rounded shadow-lg">Start Game</button>
          </div>
        )}
        <div className={`p-4 bg-[#21201d]/50 border-b border-white/5 ${isGameInProgress ? 'opacity-50 grayscale' : ''}`}>
          <div className="flex justify-between items-center mb-2"><span className="text-[10px] font-bold text-gray-500 uppercase">Bot Elo</span><span className="text-xs text-[#81b64c] font-mono">{botElo}</span></div>
          <input type="range" min="250" max="3200" step="250" value={botElo} disabled={isGameInProgress} onChange={(e) => setBotElo(Number(e.target.value))} className="w-full h-1 bg-[#403d39] rounded appearance-none cursor-pointer accent-[#81b64c]" />
        </div>
        
        <div ref={historyScrollRef} className="p-4 flex-grow overflow-y-auto custom-scrollbar bg-[#161512]/30 text-xs text-gray-200">
          <div className="grid grid-cols-3 gap-y-1">
            {Array.from({ length: Math.ceil(history.length / 2) }).map((_, i) => (
              <div key={i} className="contents">
                <div className="py-1 px-2 text-gray-500 font-mono text-[10px]">{i + 1}.</div>
                <div onClick={() => { playSound('move'); setViewIndex(i*2); }} className={`py-1 px-2 font-medium cursor-pointer hover:bg-white/10 rounded ${viewIndex === i*2 ? 'bg-white/20 text-white' : ''}`}>
                    {history[i*2]?.san || ""}
                </div>
                <div onClick={() => { if(history[i*2+1]) { playSound('move'); setViewIndex(i*2+1); } }} className={`py-1 px-2 font-medium cursor-pointer hover:bg-white/10 rounded ${viewIndex === i*2+1 ? 'bg-white/20 text-white' : ''}`}>
                    {history[i*2+1]?.san || ""}
                </div>
              </div>
            ))}
          </div>
        </div>
        {gameOver && (<div className="p-4 border-t border-white/5 bg-[#161512]"><p className="text-xs font-bold text-red-400 mb-2 text-center uppercase">{gameOver}</p><button onClick={resetGame} className="w-full py-2 bg-white text-black font-bold rounded text-xs">New Game</button></div>)}
      </div>
    </div>
  );
}