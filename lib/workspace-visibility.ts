'use client';
import {createContext,useContext} from 'react';
/** Keep record saving mounted during a lock while pausing location access. */
export const WorkspaceVisibility=createContext(true);
export function useWorkspaceVisible(){return useContext(WorkspaceVisibility);}
